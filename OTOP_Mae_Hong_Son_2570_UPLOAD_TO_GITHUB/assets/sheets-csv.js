/* OTOP Mae Hong Son v2.6 - Google Sheets-compatible CSV editor.
 * Supabase remains source of truth. Only signed-in admins can import and
 * database Row-Level Security continues to enforce write access.
 * No publicly editable Sheet/API key required.
 */
(()=>{
'use strict';
const $=s=>document.querySelector(s);
const O=window.OTOP;
const editor=window.OTOP_PRODUCT_ADMIN;
const headers=['id','district','name','category','price','unit','producer','shop','description','story','address','lat','lng','phone','line','facebook','featured','is_published','image_url_READ_ONLY'];
const textLimits={name:160,unit:40,producer:180,shop:180,description:3000,story:3000,address:400,phone:30,line:700,facebook:700};
const editable=headers.filter(x=>!['id','image_url_READ_ONLY'].includes(x));
let pending=[];
const status=(s)=>{$('#sheetsStatus').textContent=s||''};
const previewError=(s)=>{$('#sheetPreviewError').textContent=s||''};

function csvEscape(v){
  let text=String(v??'');
  // Prevent Google Sheets/Excel from evaluating untrusted product text as formulas.
  if(/^\s*[=+@\-\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
}
function downloadCsv(){
  if(!editor.isSignedIn()){status('กรุณาเข้าสู่ระบบ Admin ก่อน');return;}
  const all=editor.getRecords();
  if(all.length>5000){status('จำนวนสินค้าเกิน 5,000 รายการ กรุณาติดต่อผู้ดูแลระบบ');return;}
  if(!window.confirm('ส่งออก '+all.length+' รายการเพื่อแก้ไขด้วย Google Sheets? ไฟล์อาจมีเบอร์โทร ที่อยู่ และพิกัด โปรดเก็บไฟล์และ Google Sheet เป็นส่วนตัว'))return;
  const lines=[headers.map(csvEscape).join(',')];
  for(const p of all){
    lines.push(headers.map(k=>csvEscape(k==='image_url_READ_ONLY'?p.image:(k==='is_published'?(p.is_published!==false):k==='featured'?!!p.featured:(p[k]??'')))).join(','));
  }
  const blob=new Blob(['\ufeff'+lines.join('\r\n')+'\r\n'],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download='otop-products-for-google-sheets-'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  status('ส่งออกข้อมูล '+all.length+' รายการแล้ว ให้นำไฟล์ CSV ไปเปิดใน Google Sheets');
}
function parseCsv(raw){
  raw=raw.replace(/^\ufeff/,'');
  const result=[];let row=[],cell='',quoted=false,closed=false;
  for(let i=0;i<raw.length;i++){
    const c=raw[i];
    if(quoted){
      if(c==='"'){
        if(raw[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}
      }else cell+=c;
      continue;
    }
    if(c==='"' && !closed && cell===''){quoted=true;continue;}
    if(c===','){row.push(cell);cell='';closed=false;continue;}
    if(c==='\n'||c==='\r'){
      if(c==='\r'&&raw[i+1]==='\n')i++;
      row.push(cell);cell='';closed=false;
      if(row.some(v=>v!==''))result.push(row);
      row=[];continue;
    }
    if(closed && c!== ' ' && c!== '\t')throw Error('รูปแบบ CSV ไม่ถูกต้อง (มีข้อความต่อจากเครื่องหมายปิดคำพูด)');
    if(!closed)cell+=c;
    if(cell.length>15000)throw Error('พบข้อมูลยาวผิดปกติในไฟล์ CSV');
  }
  if(quoted)throw Error('ไฟล์ CSV มีเครื่องหมายคำพูดไม่ครบคู่');
  if(cell!==''||row.length){row.push(cell);if(row.some(v=>v!==''))result.push(row);}
  return result;
}
function fromCell(field,v,index){
  v=String(v??'');
  // Undo the harmless CSV-spreadsheet formula escaping that our exporter adds.
  if(v.startsWith("'")&&/^[=+@\-\t\r]/.test(v.slice(1)))v=v.slice(1);
  if(field==='price'){
    const t=v.replace(/,/g,'').trim();
    if(!/^\d+(\.\d{1,2})?$/.test(t))throw Error(`แถวที่ ${index}: ราคาไม่ใช่จำนวนเงินที่ถูกต้อง`);
    const n=Number(t);if(n>10000000)throw Error(`แถวที่ ${index}: ราคาเกินขอบเขต`);
    return n;
  }
  if(['lat','lng'].includes(field)){
    if(!v.trim())return null;
    if(!/^-?\d+(\.\d+)?$/.test(v.trim()))throw Error(`แถวที่ ${index}: พิกัดต้องเป็นตัวเลข`);
    const n=Number(v);if(!Number.isFinite(n)||n<(field==='lat'?-90:-180)||n>(field==='lat'?90:180))throw Error(`แถวที่ ${index}: พิกัดไม่อยู่ในช่วงที่ถูกต้อง`);
    return n;
  }
  if(['featured','is_published'].includes(field)){
    if(/^(true|1|ใช่|yes)$/i.test(v.trim()))return true;
    if(/^(false|0|ไม่|no)$/i.test(v.trim()))return false;
    throw Error(`แถวที่ ${index}: ${field} ต้องเป็น TRUE หรือ FALSE`);
  }
  v=v.trim();
  if(field==='category')v=O.canonicalCategory(v);
  if(field==='district'&&!O.DISTRICTS.includes(v))throw Error(`แถวที่ ${index}: อำเภอ '${v}' ไม่อยู่ในรายชื่อ 7 อำเภอ`);
  if(field==='category'&&!O.CATEGORIES.includes(v))throw Error(`แถวที่ ${index}: หมวดสินค้าไม่ถูกต้อง`);
  if(['name','unit','producer','shop'].includes(field)&&!v)throw Error(`แถวที่ ${index}: ห้ามเว้น ${field} ว่าง`);
  if(textLimits[field]&&v.length>textLimits[field])throw Error(`แถวที่ ${index}: ${field} ยาวเกิน ${textLimits[field]} ตัวอักษร`);
  if(['line','facebook'].includes(field)&&v&&!/^https:\/\//i.test(v))throw Error(`แถวที่ ${index}: ${field} ต้องขึ้นต้นด้วย https://`);
  return v;
}
function same(a,b){return String(a??'')===String(b??'');}
async function readFile(e){
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  if(!editor.isSignedIn()){status('กรุณาเข้าสู่ระบบ Admin');return;}
  try{
    if(file.size>5*1024*1024)throw Error('ไฟล์ CSV ต้องมีขนาดไม่เกิน 5 MB');
    const raw=await file.text(),csv=parseCsv(raw);
    if(csv.length<2)throw Error('ไม่มีข้อมูลสินค้าในไฟล์ CSV');
    const cols=csv[0].map(s=>s.trim().replace(/^\ufeff/,''));
    if(cols.length!==headers.length||!headers.every((h,i)=>h===cols[i]))
      throw Error('หัวตาราง CSV ไม่ตรงกับไฟล์ที่ส่งออกจาก Admin กรุณาดาวน์โหลดไฟล์ใหม่และคงชื่อ/ลำดับคอลัมน์เดิม');
    if(csv.length>5001)throw Error('ไฟล์มีมากกว่า 5,000 รายการ');
    const original=new Map(editor.getRecords().map(r=>[Number(r.id),r]));
    const ids=new Set(),changes=[];
    for(let i=1;i<csv.length;i++){
      const row=csv[i];
      if(row.length!==headers.length)throw Error(`แถวที่ ${i+1}: จำนวนคอลัมน์ไม่ครบ หรือมีเกินมา`);
      const num=Number(row[0]);
      if(!Number.isSafeInteger(num)||num<1)throw Error(`แถวที่ ${i+1}: ID สินค้าไม่ถูกต้อง`);
      if(ids.has(num))throw Error(`แถวที่ ${i+1}: ID ${num} ซ้ำกัน`);ids.add(num);
      const prev=original.get(num);if(!prev)throw Error(`แถวที่ ${i+1}: ไม่มีสินค้า ID ${num} ในฐานข้อมูล (เพิ่มสินค้าใหม่ผ่าน Admin เท่านั้น)`);
      const data={};for(let j=1;j<headers.length-1;j++)data[headers[j]]=fromCell(headers[j],row[j],i+1);
      if((data.lat===null)!==(data.lng===null))throw Error(`แถวที่ ${i+1}: ต้องใส่ละติจูดและลองจิจูดคู่กัน`);
      const patch={};const before={};
      for(const k of editable){
        if(!same(data[k],prev[k])){patch[k]=data[k];before[k]=prev[k]??null;}
      }
      if(Object.keys(patch).length)changes.push({id:num,name:prev.name,district:prev.district,before,patch});
    }
    if(!changes.length){status('ตรวจสอบแล้ว ไม่มีข้อมูลที่เปลี่ยนแปลง');return;}
    pending=changes;
    $('#sheetPreviewSummary').textContent=`อ่าน ${csv.length-1} รายการ · พบ ${changes.length} รายการที่จะเปลี่ยน (ไม่มีการเพิ่ม/ลบสินค้า)`;
    $('#sheetPreviewRows').innerHTML=changes.slice(0,40).map(x=>`<article class="sheet-preview-item"><b>#${x.id} ${O.esc(x.name)}</b><span>อ.${O.esc(x.district)} → ${O.esc(x.patch.district??x.district)}</span><small>แก้ไข: ${O.esc(Object.keys(x.patch).join(', '))}</small></article>`).join('')+(changes.length>40?`<p>และอีก ${changes.length-40} รายการ</p>`:'');
    $('#sheetImportConsent').checked=false;previewError('');$('#sheetsPreviewDialog').showModal();
    status('อ่านไฟล์สำเร็จ โปรดตรวจรายการในหน้าตัวอย่างก่อนยืนยัน');
  }catch(err){status('นำเข้าไม่ได้: '+(err.message||err));pending=[];}
}
async function applyImport(){
  if(!pending.length)return;
  if(!$('#sheetImportConsent').checked){previewError('กรุณายืนยันสิทธิ์ในการเผยแพร่ข้อมูลก่อน');return;}
  if(!editor.isSignedIn()){previewError('เซสชัน Admin หมดอายุ กรุณาเข้าสู่ระบบใหม่');return;}
  if(!window.confirm(`ยืนยันแก้ไขสินค้า ${pending.length} รายการในเว็บไซต์จริง? ข้อมูลที่แก้จะเผยแพร่ตามสถานะของสินค้าแต่ละรายการ`))return;
  const btn=$('#applySheetImport');btn.disabled=true;previewError('กำลังตรวจสอบข้อมูลล่าสุด…');
  let applied=0;
  try{
    // Re-read source of truth to guard against overwriting changes made
    // after the CSV preview was produced.
    let latest;
    if(editor.isOnline()){
      latest=new Map();const ids=pending.map(c=>c.id);
      for(let i=0;i<ids.length;i+=80){
        const {data,error}=await O.client().from('products').select('*').in('id',ids.slice(i,i+80));
        if(error)throw Error('ตรวจสอบข้อมูลเดิมไม่สำเร็จ: '+error.message);
        for(const r of data??[])latest.set(Number(r.id),r);
      }
    }else latest=new Map(editor.getRecords().map(x=>[Number(x.id),x]));
    for(const c of pending){
      const now=latest.get(c.id);
      if(!now)throw Error(`ไม่พบสินค้า ID ${c.id} ในระบบล่าสุด`);
      for(const [key,old] of Object.entries(c.before)){
        if(!same(now[key],old))throw Error(`สินค้า ID ${c.id} มีผู้อื่นแก้ไข ${key} หลังคุณส่งออก CSV กรุณาส่งออกใหม่เพื่อป้องกันข้อมูลทับกัน`);
      }
    }
    previewError('กำลังบันทึกข้อมูล…');
    if(editor.isOnline()){
      for(const c of pending){
        const {data,error}=await O.client().from('products').update(c.patch).eq('id',c.id).select('id');
        if(error)throw Error(`สินค้า #${c.id}: ${error.message}`);
        if(!data?.length)throw Error(`สินค้า #${c.id}: ไม่สามารถยืนยันการบันทึก (สิทธิ์ RLS) ได้`);
        applied++;
      }
    }else{
      const map=new Map(pending.map(c=>[c.id,c.patch]));
      O.saveDemoProducts(editor.getRecords().map(p=>map.has(Number(p.id))?{...p,...map.get(Number(p.id))}:p));
      applied=pending.length;
    }
    pending=[];$('#sheetsPreviewDialog').close();
    await editor.refresh();
    status(`บันทึกข้อมูลสำเร็จ ${applied} รายการ ระบบเว็บไซต์โหลดข้อมูลล่าสุดแล้ว (ลิงก์รูปภาพ Google Drive ไม่ถูกเปลี่ยน)`);
  }catch(err){
    previewError(`บันทึกไม่ครบ: สำเร็จแล้ว ${applied} รายการ · ${err.message||err} กรุณารีเฟรชและส่งออก CSV ใหม่หากจะลองต่อ`);
    status(`เกิดข้อผิดพลาดระหว่างนำเข้า อัปเดตไปแล้ว ${applied} รายการ โปรดตรวจสอบก่อนทำซ้ำ`);
  }finally{btn.disabled=false;}
}
function init(){
  $('#exportSheetCsv').addEventListener('click',downloadCsv);
  $('#importSheetCsv').addEventListener('click',()=>$('#sheetCsvFile').click());
  $('#sheetCsvFile').addEventListener('change',readFile);
  $('#closeSheetsPreview').addEventListener('click',()=>$('#sheetsPreviewDialog').close());
  $('#cancelSheetImport').addEventListener('click',()=>$('#sheetsPreviewDialog').close());
  $('#applySheetImport').addEventListener('click',applyImport);
}
document.addEventListener('DOMContentLoaded',init);
})();
