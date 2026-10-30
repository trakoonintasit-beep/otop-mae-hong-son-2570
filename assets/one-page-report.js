/* OTOP Mae Hong Son v2.7 – authenticated single-page product report editor.
   The report reads base products from Supabase; only supplemental fields are written
   to otop_product_report_details. No Drive files, tokens or private passwords stored. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const O=window.OTOP;
const DISTRICTS=O?.DISTRICTS||['เมืองแม่ฮ่องสอน','ปาย','ปางมะผ้า','ขุนยวม','แม่ลาน้อย','แม่สะเรียง','สบเมย'];
const ADDITIONAL=['village','subdistrict','highlights','ingredients','process','benefits','usage','size_weight','packaging','certifications','awards','report_note','reporter','secondary_image_1','secondary_image_2'];
const NO='ไม่ระบุข้อมูล';
const SITE='https://trakoonintasit-beep.github.io/otop-mae-hong-son-2570/index.html#catalog';
let products=[],selected=null,selectedExtra=null,authorizedUser=null,loadedFor=null,working=false,imageReady=false,renderTimer=null;
let lastQrLink='';
let officerDistrict=null;
const escapeHtml=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function getVal(id){return $(id).value.trim();}
function setStatus(message,isError=false){$('saveStatus').textContent=message;$('saveStatus').classList.toggle('error',!!isError);}
function viewVal(v){return String(v??'').trim()||NO;}
function text(id,v){$(id).textContent=viewVal(v);}
function fmtMoney(value){const n=Number(value);return Number.isFinite(n)?new Intl.NumberFormat('th-TH',{maximumFractionDigits:2}).format(n)+' บาท':NO;}
function queryId(){return new URLSearchParams(location.search).get('id')||'';}
async function start(){
  if(!O?.configured){return deny('ระบบรายงาน One Page ต้องเชื่อม Supabase จึงจะใช้กับข้อมูลจริงได้');}
  let user, member;
  try{
    const response=await O.client().auth.getUser();
    user=response.data.user;
    if(response.error||!user)throw new Error('ไม่ได้เข้าสู่ระบบ');
    member=await O.client().from('admins').select('user_id,role,is_active,district').eq('user_id',user.id).maybeSingle();
    if(member.error||!member.data||member.data.is_active!==true)throw new Error('บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลที่เปิดใช้งาน');
  }catch(err){return deny('กรุณาเข้าสู่ระบบ Admin ก่อนเข้า One Page ('+(err.message||'เซสชันหมดอายุ')+')');}
  officerDistrict=member.data.role==='district_officer'?member.data.district:null;
  if(officerDistrict&&!DISTRICTS.includes(officerDistrict))return deny('บัญชีเจ้าหน้าที่ไม่มีอำเภอที่ได้รับมอบหมาย');
  authorizedUser=user;
  $('guard').hidden=true;$('reportApp').hidden=false;
  await loadProducts();
  attachEvents();
  startAutoRefresh();
}
function deny(message){$('guard').querySelector('h1').textContent='ไม่สามารถเปิด One Page ได้';$('guard').querySelector('p').textContent=message;}

// Refresh database-backed product information without resetting report edits or overwriting unsaved fields.
const REFRESH_MS=5*60*1000;
let refreshingBase=false,lastBaseRefresh=Date.now();
async function refreshBaseProducts(){
  if(refreshingBase||working||document.hidden||!authorizedUser||!$('reportApp')||$('reportApp').hidden)return;
  refreshingBase=true;
  try{
    const auth=await O.client().auth.getUser();
    if(auth.error||!auth.data?.user||auth.data.user.id!==authorizedUser.id){
      $('reportApp').hidden=true;$('guard').hidden=false;
      deny('เซสชัน Admin หมดอายุ กรุณาเข้าสู่ระบบใหม่');return;
    }
    const rows=[],limit=500;
    for(let offset=0;offset<20000;offset+=limit){
      let q=O.client().from('products').select('*');
      if(officerDistrict)q=q.eq('district',officerDistrict);
      const r=await q.order('id',{ascending:false}).range(offset,offset+limit-1);
      if(r.error)throw r.error;
      rows.push(...(r.data||[]));
      if(!r.data||r.data.length<limit)break;
    }
    const savedChoice=$('productSelect').value,oldSelectedId=selected?.id;
    products=rows;
    if(oldSelectedId!=null){
      const current=rows.find(p=>String(p.id)===String(oldSelectedId));
      if(current){selected=current;render();}
      else {selected=null;loadedFor=null;render();setStatus('สินค้าเดิมถูกลบหรือสิทธิ์เปลี่ยน กรุณาเลือกสินค้าใหม่',true);}
    }
    // Rebuild selector without calling selectProduct(): that would erase unsaved edits.
    const district=getVal('districtSelect'),search=getVal('productSearch').toLowerCase();
    const choices=rows.filter(p=>(!district||p.district===district)&&(!search||[p.name,p.producer,p.shop,p.category].join(' ').toLowerCase().includes(search)));
    $('productSelect').innerHTML=choices.map(p=>`<option value="${Number(p.id)}">#${Number(p.id)} · ${escapeHtml(p.name||'(ไม่มีชื่อ)')} — ${escapeHtml(p.district||'')}</option>`).join('')||'<option value="">ไม่พบสินค้า</option>';
    // Keep the report item visible even when its updated district/name no longer matches active filters.
    if(selected&&!choices.some(p=>String(p.id)===String(selected.id))){
      const option=document.createElement('option');option.value=String(selected.id);
      option.textContent='#'+selected.id+' · '+selected.name+' (กำลังแก้ไข · ไม่ตรงตัวกรอง)';
      $('productSelect').prepend(option);
    }
    if(selected)$('productSelect').value=String(selected.id);
    else if(choices.some(p=>String(p.id)===String(savedChoice)))$('productSelect').value=savedChoice;
    lastBaseRefresh=Date.now();
    $('productStatus').textContent=`พบสินค้า ${rows.length} รายการ · รีเฟรชฐานข้อมูลล่าสุด ${new Date(lastBaseRefresh).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})} น. · ข้อมูลที่กรอกยังคงอยู่`;
  }catch(err){setStatus('รีเฟรชฐานข้อมูลไม่สำเร็จ: '+(err.message||err)+' · ข้อมูลที่กรอกไม่ได้ถูกลบ',true);}
  finally{refreshingBase=false;}
}
function startAutoRefresh(){
  setInterval(()=>{if(Date.now()-lastBaseRefresh>=REFRESH_MS)void refreshBaseProducts();},REFRESH_MS);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastBaseRefresh>=REFRESH_MS)void refreshBaseProducts();});
}

async function loadProducts(){
  try{
    const all=[],limit=500;let startAt=0;
    for(;;){
      let query=O.client().from('products').select('*');
      if(officerDistrict)query=query.eq('district',officerDistrict);
      const r=await query.order('id',{ascending:false}).range(startAt,startAt+limit-1);
      if(r.error)throw r.error;
      all.push(...(r.data||[]));
      if(!r.data||r.data.length<limit)break;
      startAt+=limit;
      if(startAt>=20000)throw Error('มีสินค้ามากกว่า 20,000 รายการ กรุณาติดต่อผู้ดูแลระบบ');
    }
    products=all;
    $('districtSelect').innerHTML='<option value="">ทุกอำเภอ</option>'+DISTRICTS.map(d=>`<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
    if(officerDistrict){$('districtSelect').value=officerDistrict;$('districtSelect').disabled=true;}
    const requested=queryId();
    if(requested){const target=products.find(p=>String(p.id)===requested);if(target)$('districtSelect').value=target.district||'';}
    filterProducts(requested);
    $('productStatus').textContent=`พบสินค้า ${products.length} รายการในฐานข้อมูล`;
  }catch(err){$('productStatus').textContent='โหลดสินค้าไม่สำเร็จ: '+(err.message||err);setStatus('อ่านข้อมูลสินค้าไม่สำเร็จ',true);}
}
function filterProducts(prefer=''){
  const district=getVal('districtSelect');
  const search=getVal('productSearch').toLowerCase();
  const choices=products.filter(p=>(!district||p.district===district)&&(!search||[p.name,p.producer,p.shop,p.category].join(' ').toLowerCase().includes(search)));
  const prev=prefer||$('productSelect').value;
  const options=choices.map(p=>`<option value="${Number(p.id)}">#${Number(p.id)} · ${escapeHtml(p.name||'(ไม่มีชื่อ)')} — ${escapeHtml(p.district||'')}</option>`).join('');
  $('productSelect').innerHTML=options||'<option value="">ไม่พบสินค้า</option>';
  if(choices.some(p=>String(p.id)===String(prev)))$('productSelect').value=String(prev);
  if($('productSelect').value){void selectProduct($('productSelect').value);}else{selected=null;render();}
}
async function selectProduct(id){
  if(!/^\d+$/.test(String(id)))return;
  const product=products.find(p=>String(p.id)===String(id));if(!product)return;
  selected=product;
  loadedFor=null;
  $('productStatus').textContent='กำลังโหลดรายละเอียดรายงาน '+product.name+'…';
  for(const input of document.querySelectorAll('[data-extra]'))input.value='';
  $('reportHeadline').value='';$('themeSelect').value='official';$('accentColor').value='#195445';
  $('includeContact').checked=false;$('contactConsent').checked=false;$('includeQR').checked=true;
  render();
  try{
    const r=await O.client().from('otop_product_report_details').select('*').eq('product_id',product.id).maybeSingle();
    if(selected?.id!==product.id)return;
    if(r.error){
      selectedExtra=null;
      $('productStatus').textContent='อ่านส่วนเสริมไม่ได้: โปรดติดตั้ง SQL v2.7 ก่อนบันทึก ('+(r.error.message||'')+')';
    }else{
      selectedExtra=r.data||null;
      fillExtra(r.data);
      loadedFor=product.id;
      $('productStatus').textContent='เลือกสินค้า #'+product.id+' · '+product.name+(r.data?' · มีข้อมูล One Page ที่บันทึกแล้ว':' · ยังไม่มีข้อมูลเสริม');
    }
  }catch(err){$('productStatus').textContent='เกิดปัญหาโหลดรายละเอียด: '+err.message;}
  render();
}
function fillExtra(data){
  for(const input of document.querySelectorAll('[data-extra]'))input.value=String(data?.[input.dataset.extra]||'');
  $('reportHeadline').value=String(data?.report_headline||'');
  $('themeSelect').value=data?.report_theme==='showcase'?'showcase':'official';
  $('accentColor').value=/^#[0-9a-f]{6}$/i.test(data?.report_accent||'')?data.report_accent:'#195445';
}
function extra(k){return document.querySelector('[data-extra="'+k+'"]').value.trim();}
function objExtra(){return Object.fromEntries(ADDITIONAL.map(k=>[k,extra(k)]));}
function joinParts(...values){return values.map(v=>String(v??'').trim()).filter(Boolean).join(' · ');}
function buildMapLink(p){
  const lat=Number(p?.lat),lng=Number(p?.lng);
  if(!p||p.lat==null||p.lng==null||!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180)return '';
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
function updateQR(p){
  const root=$('qrWrap'),target=$('qrCode');
  if(!p||!$('includeQR').checked){root.hidden=true;target.replaceChildren();lastQrLink='';return;}
  root.hidden=false;
  const map=buildMapLink(p),url=map||SITE;
  $('qrLabel').textContent=map?'สแกนเพื่อเปิดเส้นทางร้านค้า':'สแกนเพื่อเปิดแคตตาล็อก OTOP';
  if(lastQrLink===url&&target.childNodes.length)return;
  lastQrLink=url;target.replaceChildren();
  if(typeof window.QRCode==='function'){
    try{new window.QRCode(target,{text:url,width:90,height:90,correctLevel:window.QRCode.CorrectLevel.M});}
    catch(_){target.textContent='QR';}
  }else{target.textContent='QR';}
}
function render(){
  const p=selected||{};
  $('reportSheet').classList.toggle('template-showcase',$('themeSelect').value==='showcase');
  $('reportSheet').classList.toggle('template-official',$('themeSelect').value!=='showcase');
  $('reportSheet').style.setProperty('--accent',getVal('accentColor')||'#195445');
  $('rName').textContent=selected?viewVal(p.name):'เลือกสินค้าเพื่อสร้างรายงาน';
  text('rHeadline',getVal('reportHeadline')||'ข้อมูลผลิตภัณฑ์และภูมิปัญญาชุมชน');
  text('rId',selected?'OTOP-'+p.id:'—');
  text('rCategory',p.category);
  text('rDistrict',joinParts(p.district,'จังหวัดแม่ฮ่องสอน'));
  text('rProducer',p.producer);
  text('rPrice',selected?fmtMoney(p.price)+' / '+viewVal(p.unit):'—');
  text('rSize',joinParts(extra('size_weight'),extra('packaging')));
  text('rStory',p.story);
  text('rDescription',p.description);
  $('rHighlights').textContent=extra('highlights')?'จุดเด่น: '+extra('highlights'):'';
  text('rIngredients',extra('ingredients'));
  text('rProcess',extra('process'));
  text('rBenefits',extra('benefits'));
  $('rUsage').textContent=extra('usage')?'วิธีใช้: '+extra('usage'):'';
  text('rCertifications',extra('certifications')?'มาตรฐาน: '+extra('certifications'):'ไม่มีข้อมูลมาตรฐานหรือการรับรอง');
  $('rAwards').textContent=extra('awards')?'รางวัล: '+extra('awards'):'';
  text('rShop',p.shop?'จุดจำหน่าย: '+p.shop:'');
  text('rLocation',joinParts(extra('village'),extra('subdistrict'),p.district,p.address,buildMapLink(p)?'พิกัด: '+Number(p.lat).toFixed(6)+', '+Number(p.lng).toFixed(6):''));
  $('rContact').textContent=$('includeContact').checked?joinParts(p.phone?'โทร. '+p.phone:'',p.line?'LINE: '+p.line:'',p.facebook?'Facebook: '+p.facebook:''):'ไม่แสดงข้อมูลติดต่อในรายงาน';
  $('rContact').hidden=!$('includeContact').checked;
  $('reportNoteBlock').hidden=!extra('report_note');
  text('rReportNote',extra('report_note'));
  const today=new Intl.DateTimeFormat('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'long',year:'numeric'}).format(new Date());
  const officer=extra('reporter');
  $('rPrepared').textContent='จัดทำ ณ วันที่ '+today+(officer?' · '+officer:'');
  $('rStatus').textContent=selected?((p.is_published===false?'สถานะ: ยังไม่เผยแพร่':'สถานะ: เผยแพร่')+(p.featured?' · สินค้าแนะนำ':'')):'เลือกสินค้าเพื่อจัดทำรายงาน';
  const img=$('rImage');
  const imageUrl=selected?O.imgUrl(p.image):'';
  if(img.dataset.url!==imageUrl){
    imageReady=false;img.dataset.url=imageUrl;
    img.removeAttribute('src');img.alt='ภาพประกอบ '+(p.name||'สินค้า');
    if(imageUrl){img.src=imageUrl;}else img.alt='ยังไม่มีรูปสินค้า';
  }
  updateQR(selected);
  if(renderTimer)clearTimeout(renderTimer);
  renderTimer=setTimeout(checkFit,130);
}
function checkFit(){
  const root=$('reportSheet');root.style.setProperty('--s','1');
  let best=1;
  for(const ratio of [1,.97,.94,.91,.88,.85,.82,.79,.76]){
    root.style.setProperty('--s',String(ratio));
    // Account for absolute size and content that extends beyond fixed A4 paper.
    if(root.scrollHeight <= root.clientHeight+2){best=ratio;break;}
    best=ratio;
  }
  const overflow=root.scrollHeight>root.clientHeight+2;
  const message=overflow?'ข้อมูลมากเกิน A4 หน้าเดียว — กรุณาย่อข้อความเพิ่มเติม':'พร้อมจัดทำรายงาน A4 หน้าเดียว'+(best<1?' · ปรับขนาดข้อความให้พอดี':'');
  $('fitStatus').textContent=message;$('fitStatus').classList.toggle('warn',overflow);
  $('printReport').disabled=overflow||!selected;
  $('savePng').disabled=overflow||!selected;
  return !overflow;
}
function imageLoad(){
  return new Promise((resolve,reject)=>{
    const img=$('rImage');
    if(!selected||!img.getAttribute('src'))return reject(Error('ยังไม่ได้เลือกรูปสินค้า'));
    if(img.complete){if(img.naturalWidth)return resolve(true);return reject(Error('รูปสินค้าโหลดไม่สำเร็จ กรุณาตรวจ Edge Function otop-drive-image'));}
    const timeout=setTimeout(()=>{cleanup();reject(Error('รูปภาพโหลดนานเกินไป กรุณาลองใหม่'));},25000);
    function cleanup(){clearTimeout(timeout);img.removeEventListener('load',success);img.removeEventListener('error',fail);}
    function success(){cleanup();resolve(true);}
    function fail(){cleanup();reject(Error('โหลดรูปสินค้าไม่ได้ กรุณาตรวจ Google Drive'));}
    img.addEventListener('load',success,{once:true});img.addEventListener('error',fail,{once:true});
  });
}
function consentCheck(){
  if(!selected)throw Error('กรุณาเลือกสินค้า');
  if(!checkFit())throw Error('ข้อมูลเกินหนึ่งหน้า A4 กรุณาลดข้อความที่ยาวเกินไป');
  if($('includeContact').checked&&!$('contactConsent').checked)throw Error('กรุณายืนยันสิทธิ์การเผยแพร่ข้อมูลติดต่อก่อนส่งออก');
  if(!authorizedUser)throw Error('กรุณาเข้าสู่ระบบ Admin');
}
async function save(){
  if(working)return;
  try{
    if(!selected||!authorizedUser)throw Error('กรุณาเลือกสินค้าและเข้าสู่ระบบก่อน');
    if(!loadedFor || Number(loadedFor)!==Number(selected.id))throw Error('ยังโหลดข้อมูล One Page ไม่ครบ หรือยังไม่ได้ติดตั้ง SQL v2.7');
    working=true;$('saveExtra').disabled=true;setStatus('กำลังบันทึกส่วนเสริมของสินค้า #'+selected.id+'...');
    const payload={product_id:Number(selected.id),...objExtra(),report_headline:getVal('reportHeadline'),report_theme:getVal('themeSelect'),report_accent:getVal('accentColor'),updated_by:authorizedUser.id,updated_at:new Date().toISOString()};
    const result=await O.client().from('otop_product_report_details').upsert(payload,{onConflict:'product_id'}).select('product_id').single();
    if(result.error)throw result.error;
    selectedExtra=payload;
    setStatus('บันทึกข้อมูลรายงานสินค้า #'+selected.id+' สำเร็จ (ไม่เปลี่ยนข้อมูลสินค้าเดิมหรือภาพใน Drive)');
  }catch(err){setStatus('บันทึกไม่สำเร็จ: '+(err.message||err),true);}
  finally{working=false;$('saveExtra').disabled=false;}
}
async function printPdf(){
  try{consentCheck();await imageLoad();if(!checkFit())throw Error('เนื้อหาเกินหน้า A4');window.print();setStatus('เปิดหน้าพิมพ์แล้ว กรุณาเลือกปลายทาง “บันทึกเป็น PDF” และขนาดกระดาษ A4');}
  catch(err){setStatus('ส่งออก PDF ไม่ได้: '+err.message,true);}
}
async function savePng(){
  try{
    consentCheck();await imageLoad();
    if(!window.htmlToImage?.toPng)throw Error('ไม่สามารถโหลดตัวสร้าง PNG ได้ ตรวจการเชื่อมต่อ CDN หรือปิดส่วนขยายที่บล็อกสคริปต์');
    $('savePng').disabled=true;setStatus('กำลังสร้างภาพ PNG ความละเอียดสูง...');
    const data=await window.htmlToImage.toPng($('reportSheet'),{pixelRatio:2,cacheBust:false,backgroundColor:'#fff',skipAutoScale:true});
    const a=document.createElement('a');a.href=data;a.download='OTOP-OnePage-'+selected.id+'-'+Date.now()+'.png';document.body.appendChild(a);a.click();a.remove();
    setStatus('สร้าง PNG สำเร็จ');
  }catch(err){setStatus('ส่งออก PNG ไม่สำเร็จ: '+(err.message||err)+' · หากรูปภาพข้ามโดเมนถูกบล็อก ให้ใช้ “บันทึก PDF” ก่อน',true);}
  finally{$('savePng').disabled=false;}
}
function attachEvents(){
  $('districtSelect').addEventListener('change',()=>filterProducts());
  $('productSearch').addEventListener('input',()=>filterProducts());
  $('productSelect').addEventListener('change',e=>{void selectProduct(e.target.value);});
  for(const input of document.querySelectorAll('#reportApp input,#reportApp textarea,#reportApp select')){
    if(['districtSelect','productSearch','productSelect'].includes(input.id))continue;
    input.addEventListener('input',render);
    input.addEventListener('change',render);
  }
  $('saveExtra').addEventListener('click',save);
  $('reloadExtra').addEventListener('click',()=>selected&&selectProduct(String(selected.id)));
  $('printReport').addEventListener('click',printPdf);
  $('savePng').addEventListener('click',savePng);
  // QRCode library is deferred and may load after initial product; redraw when ready.
  window.addEventListener('load',()=>{lastQrLink='';if(selected)render();});
  window.addEventListener('beforeprint',()=>{checkFit();});
}
start().catch(err=>deny('เกิดข้อผิดพลาด: '+err.message));
})();
