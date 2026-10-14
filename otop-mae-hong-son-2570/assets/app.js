'use strict';
const O = window.OTOP;
const $ = selector => document.querySelector(selector);
let products = []; let filtered = []; let map; let markers=[];
let currentProductId=null;let visibleLimit=8;
const PER_PAGE=8;

async function loadProducts() {
  try {
    products = await O.sourceProducts();
    $('#totalProducts').textContent = products.length;
    $('#dataBadgeTitle').textContent = O.configured ? 'ข้อมูลออนไลน์' : 'ข้อมูลสาธิต';
    $('#mapDescription').textContent = O.configured ? 'แสดงพิกัดร้านค้าจากข้อมูลที่ผู้ดูแลได้อนุญาตเผยแพร่' : 'หมุดทั้งหมดเป็นพิกัดสาธิตระดับอำเภอ ไม่ใช่ตำแหน่งร้านจริง';
    $('#dataBadge').textContent = O.configured ? 'ข้อมูลจากฐานข้อมูลออนไลน์ ตรวจสอบข้อมูลกับผู้ผลิตก่อนใช้' : 'การแก้ไขในโหมดสาธิตบันทึกเฉพาะเบราว์เซอร์นี้';
    $('#categoryFilter').innerHTML = '<option value="">ทุกหมวด</option>' + O.CATEGORIES.map(v=>`<option value="${O.esc(v)}">${O.esc(v)}</option>`).join('');
    $('#districtFilter').innerHTML = '<option value="">ทุกอำเภอ</option>' + O.DISTRICTS.map(v=>`<option value="${O.esc(v)}">${O.esc(v)}</option>`).join('');
    renderCategoryQuickFilters();
    applyFilters();
    if (location.hash.startsWith('#product-')) openFromHash();
  } catch(error) {
    $('#resultCount').textContent = 'เกิดข้อผิดพลาด';
    $('#productGrid').innerHTML = `<p class="error-note" role="alert">โหลดสินค้าไม่สำเร็จ: ${O.esc(error.message)}</p>`;
  }
}
function init() {
  for (const selector of ['#searchInput','#categoryFilter','#districtFilter','#sortFilter']) {
    $(selector).addEventListener(selector === '#searchInput' ? 'input' : 'change', () => {visibleLimit=PER_PAGE;applyFilters();});
  }
  $('#clearFilters').addEventListener('click', resetFilters);
  $('#categoryQuickFilters').addEventListener('click', e=>{const btn=e.target.closest('[data-category-quick]');if(!btn)return;$('#categoryFilter').value=btn.dataset.categoryQuick;visibleLimit=PER_PAGE;applyFilters();});
  $('#showAllMarkers').addEventListener('click',resetFilters);
  $('#closeDialog').addEventListener('click',()=>$('#productDialog').close());
  $('#productDialog').addEventListener('close',()=>{currentProductId=null;$('#sharePanel').hidden=true;if(location.hash.startsWith('#product-'))history.replaceState(null,'',location.pathname+location.search);});
  $('#productDialog').addEventListener('click',e=>{if(e.target === $('#productDialog'))$('#productDialog').close();});
  $('#productGrid').addEventListener('click',e=>{const b=e.target.closest('[data-product-id]');if(b)openProduct(Number(b.dataset.productId));const share=e.target.closest('[data-share-id]');if(share)openProduct(Number(share.dataset.shareId),true);});
  $('#loadMore').addEventListener('click',()=>{visibleLimit+=PER_PAGE;renderProducts();});
  $('#copyProductLink').addEventListener('click',copyProductLink);
  $('#downloadQr').addEventListener('click',downloadQr);
  window.addEventListener('hashchange',openFromHash);
  $('#dialogContent').addEventListener('click',e=>{const b=e.target.closest('[data-map-product]');if(b)focusOnMap(Number(b.dataset.mapProduct));});
  $('#mapList').addEventListener('click',e=>{const prod=e.target.closest('[data-map-open-product]');if(prod){openProduct(Number(prod.dataset.mapOpenProduct));return;}const b=e.target.closest('[data-shop-index]');if(b)focusShop(Number(b.dataset.shopIndex));});
  initMap(); loadProducts(); initVisitorCounter();
  window.addEventListener('storage', e=> { if(e.key===O.STORAGE_KEY)loadProducts(); });
  window.addEventListener('focus',()=>{if(!O.configured)loadProducts();});
}
function renderCategoryQuickFilters(){
  const selected=$('#categoryFilter').value;
  $('#categoryQuickFilters').innerHTML=[['','✨ ทั้งหมด'],...O.CATEGORIES.map(x=>[x,x])].map(([value,label])=>`<button type="button" class="category-pill ${selected===value?'active':''}" data-category-quick="${O.esc(value)}" aria-pressed="${selected===value}">${O.esc(label)}</button>`).join('');
}
function resetFilters(){ $('#searchInput').value='';$('#categoryFilter').value='';$('#districtFilter').value='';$('#sortFilter').value='featured';visibleLimit=PER_PAGE;applyFilters();}
function applyFilters() {
  const q=$('#searchInput').value.trim().toLowerCase();const cat=$('#categoryFilter').value;const dist=$('#districtFilter').value;
  filtered=products.filter(p => {
    const hay=[p.name,p.category,p.district,p.producer,p.shop,p.description,p.story,p.address].join(' ').toLowerCase();
    return (!q||hay.includes(q)) && (!cat||O.canonicalCategory(p.category)===cat) && (!dist||p.district===dist);
  });
  const sort=$('#sortFilter').value;
  filtered.sort((a,b)=>sort==='priceAsc'?a.price-b.price:sort==='priceDesc'?b.price-a.price:sort==='name'?String(a.name).localeCompare(b.name,'th'):(Number(b.featured)-Number(a.featured)||Number(a.id)-Number(b.id)));
  renderCategoryQuickFilters(); renderProducts(); renderMapMarkers();
}
function renderProducts(){
  $('#resultCount').textContent=`พบ ${filtered.length} รายการ`;
  $('#emptyState').hidden=filtered.length>0;
  $('#loadMoreControls').hidden=filtered.length<=visibleLimit;
  $('#loadMore').textContent=`แสดงสินค้าเพิ่มเติม (${Math.max(0,filtered.length-visibleLimit)} รายการ) ↓`;
  $('#productGrid').innerHTML=filtered.slice(0,visibleLimit).map(p=>`<article class="product-card"><img class="product-image" loading="lazy" src="${O.esc(O.imgUrl(p.image))}" alt="ภาพประกอบ ${O.esc(p.name)}"><div class="product-body"><div class="chips"><span class="chip">${O.esc(O.canonicalCategory(p.category))}</span>${p.featured?'<span class="chip featured">แนะนำ</span>':''}</div><h3>${O.esc(p.name)}</h3><div class="product-meta">${O.esc(p.district)} · ${O.esc(p.producer)}</div><div class="product-foot"><div class="price">${O.money(p.price)} <small>/ ${O.esc(p.unit)}</small></div><button class="text-btn" data-product-id="${Number(p.id)}" type="button">ดูรายละเอียด →</button></div><button class="share-quick" type="button" data-share-id="${Number(p.id)}" aria-label="แชร์ ${O.esc(p.name)}">🔗 แชร์สินค้า / QR Code</button></div></article>`).join('');
}
function productUrl(id){return location.origin+location.pathname+location.search+'#product-'+encodeURIComponent(id);}
function openFromHash(){
  const m=location.hash.match(/^#product-(\d+)$/);
  if(m&&products.length)openProduct(Number(m[1]),false);
  else if(!m&&$('#productDialog').open)$('#productDialog').close();
}
function qrCreate(){
  const holder=$('#productQr');holder.innerHTML='';
  const url=productUrl(currentProductId);
  if(typeof QRCode==='undefined'){
    holder.textContent='ไม่สามารถสร้าง QR ได้ขณะนี้ กรุณาใช้ปุ่มคัดลอกลิงก์';
    $('#downloadQr').disabled=true;return;
  }
  $('#downloadQr').disabled=false;
  new QRCode(holder,{text:url,width:160,height:160,colorDark:'#173c33',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});
}
async function copyProductLink(){
  if(currentProductId===null)return;
  const url=productUrl(currentProductId);
  try{await navigator.clipboard.writeText(url);$('#shareStatus').textContent='คัดลอกลิงก์สินค้าแล้ว';}
  catch(e){$('#shareStatus').textContent='คัดลอกอัตโนมัติไม่ได้: '+url;}
}
function downloadQr(){
  if(currentProductId===null)return;
  const canvas=$('#productQr canvas'),img=$('#productQr img');
  const data=canvas?canvas.toDataURL('image/png'):(img?img.src:'');
  if(!data||!data.startsWith('data:image/')){$('#shareStatus').textContent='ยังไม่สามารถบันทึก QR ได้ กรุณาคัดลอกลิงก์แทน';return;}
  const a=document.createElement('a');a.href=data;a.download='OTOP-2570-product-'+currentProductId+'-QR.png';document.body.appendChild(a);a.click();a.remove();
  $('#shareStatus').textContent='บันทึก QR Code แล้ว';
}
function openProduct(id,showShare=false){
  const p=products.find(row=>Number(row.id)===id);if(!p)return;
  currentProductId=id;
  const google=O.gmap(p.lat,p.lng),fb=O.externalUrl(p.facebook),line=O.externalUrl(p.line),tel=O.whatsappPhone(p.phone);
  const links=[google&&O.configured?`<a href="${google}" target="_blank" rel="noopener noreferrer">เปิดเส้นทาง Google Maps</a>`:'',tel?`<a href="tel:${O.esc(tel)}">โทร ${O.esc(p.phone)}</a>`:'',line?`<a href="${O.esc(line)}" target="_blank" rel="noopener noreferrer">ติดต่อ LINE</a>`:'',fb?`<a href="${O.esc(fb)}" target="_blank" rel="noopener noreferrer">Facebook</a>`:'',google?`<button type="button" class="secondary" data-map-product="${id}">ดูบนแผนที่</button>`:''].join('');
  $('#dialogContent').innerHTML=`<div class="dialog-layout"><img src="${O.esc(O.imgUrl(p.image))}" alt="ภาพประกอบ ${O.esc(p.name)}"><div class="dialog-info"><div class="chips"><span class="chip">${O.esc(O.canonicalCategory(p.category))}</span><span class="chip">${O.esc(p.district)}</span></div><h2>${O.esc(p.name)}</h2><div class="price">${O.money(p.price)} <small>/ ${O.esc(p.unit)}</small></div><p>${O.esc(p.description)}</p><div class="details"><div class="detail"><small>ผู้ผลิต</small><b>${O.esc(p.producer)}</b></div><div class="detail"><small>ร้าน</small><b>${O.esc(p.shop)}</b></div><div class="detail"><small>ที่ตั้ง</small><b>${O.esc(p.address||p.district)}</b></div><div class="detail"><small>สถานะข้อมูล</small><b>${O.configured?'ฐานข้อมูลออนไลน์':'สาธิต'}</b></div></div><h3>เรื่องราวสินค้า</h3><p>${O.esc(p.story)}</p><div class="notice">${O.configured?'ติดต่อผู้ผลิตเพื่อยืนยันข้อมูลและราคาล่าสุดก่อนสั่งซื้อ':'ข้อมูลในโหมดสาธิต ไม่ใช่ข้อมูลร้านค้าจริง'}</div><div class="dialog-actions">${links||'<span>ยังไม่มีข้อมูลติดต่อ</span>'}</div></div></div>`;
  if(!$('#productDialog').open)$('#productDialog').showModal();
  history.replaceState(null,'',productUrl(id));
  $('#sharePanel').hidden=false;
  $('#shareStatus').textContent=showShare?'สแกน QR Code หรือคัดลอกลิงก์สินค้าเพื่อแชร์':'ลิงก์สินค้านี้สามารถแชร์ได้';
  qrCreate();
}
function initMap(){
  if(!window.L){$('#map').textContent='ไม่สามารถโหลดแผนที่ได้';return;}
  map=L.map('map',{scrollWheelZoom:false}).setView([18.9,98],8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
  setTimeout(()=>map.invalidateSize(),150);
}
function createPopupProduct(p) {
  const button=document.createElement('button');button.type='button';button.className='map-popup-product';
  const photo=document.createElement('img');photo.src=O.imgUrl(p.image);photo.alt='ภาพสินค้า '+p.name;photo.loading='lazy';
  const desc=document.createElement('span');desc.className='map-popup-desc';
  const title=document.createElement('strong');title.textContent=p.name;
  const price=document.createElement('small');price.textContent=O.money(p.price)+' / '+(p.unit||'ชิ้น');
  const action=document.createElement('em');action.textContent='ดูรายละเอียด →';
  desc.append(title,price,action);button.append(photo,desc);
  button.addEventListener('click',()=>openProduct(Number(p.id)));
  return button;
}
function renderMapMarkers(){
  if(!map)return;
  markers.forEach(x=>x.marker.remove());markers=[];
  const shops=new Map();
  filtered.forEach(p=>{
    if(!O.gmap(p.lat,p.lng))return;
    const key=`${p.shop}|${p.lat}|${p.lng}`;
    if(!shops.has(key))shops.set(key,{shop:p.shop,district:p.district,lat:Number(p.lat),lng:Number(p.lng),items:[]});
    shops.get(key).items.push(p);
  });
  const list=[];
  shops.forEach(s=>{
    const popup=document.createElement('div');popup.className='otop-map-popup';
    const title=document.createElement('strong');title.className='map-popup-title';title.textContent=s.shop;
    const label=document.createElement('div');label.className='map-popup-location';label.textContent='📍 '+s.district+' · '+s.items.length+' สินค้า';
    popup.append(title,label);
    const grid=document.createElement('div');grid.className='map-popup-grid';
    s.items.slice(0,4).forEach(p=>grid.appendChild(createPopupProduct(p)));
    popup.append(grid);
    if(s.items.length>4){const extra=document.createElement('small');extra.className='map-popup-extra';extra.textContent='และอีก '+(s.items.length-4)+' รายการ';popup.append(extra);}
    if(!O.configured){const note=document.createElement('p');note.className='map-demo-note';note.textContent='พิกัดตัวอย่าง ไม่ใช่ที่ตั้งร้านจริง';popup.append(note);}
    const photo=O.esc(O.imgUrl(s.items[0].image));
    const icon=L.divIcon({
      className:'otop-photo-marker',
      html:`<div class="otop-marker-photo"><img src="${photo}" alt=""></div><span class="otop-marker-pin"></span>`,
      iconSize:[52,67],iconAnchor:[26,67],popupAnchor:[0,-58]
    });
    const marker=L.marker([s.lat,s.lng],{icon}).addTo(map).bindPopup(popup,{maxWidth:330,minWidth:245});
    const i=markers.length;markers.push({data:s,marker});
    const thumb=s.items[0];
    list.push(`<button class="map-item map-card" type="button" data-shop-index="${i}" aria-label="แสดงร้าน ${O.esc(s.shop)} บนแผนที่"><img src="${O.esc(O.imgUrl(thumb.image))}" alt="ภาพสินค้า ${O.esc(thumb.name)}" loading="lazy"><span class="map-card-body"><b>${O.esc(s.shop)}</b><span>📍 ${O.esc(s.district)} · ${s.items.length} สินค้า</span><span>${O.esc(s.items.map(x=>x.name).join(' · '))}</span><strong class="map-card-action">แตะเพื่อดูภาพในหมุด →</strong></span></button>`);
  });
  $('#mapList').innerHTML=list.join('')||'<p class="notice">ไม่พบร้านที่มีพิกัดในรายการนี้</p>';
  if(markers.length)map.fitBounds(L.featureGroup(markers.map(x=>x.marker)).getBounds().pad(.2),{maxZoom:10});
}

function focusShop(i){const x=markers[i];if(!x)return;map.setView([x.data.lat,x.data.lng],11);x.marker.openPopup();$('#map-section').scrollIntoView({behavior:'smooth'});}
function focusOnMap(id){const p=products.find(x=>Number(x.id)===id);if(!p)return;$('#productDialog').close();const i=markers.findIndex(x=>x.data.shop===p.shop&&x.data.lat===Number(p.lat));if(i>=0)focusShop(i);else $('#map-section').scrollIntoView({behavior:'smooth'});}
// Counts daily browser visits approximately. This is not a distinct-people counter.
// Supabase RPCs are required for a shared, persistent count. No fake local count is shown.
async function initVisitorCounter(){
  const el=$('#visitorCount'),hint=$('#visitStatus');
  if(!el||!hint)return;
  if(!O.configured){el.textContent='—';hint.textContent='รอตั้งค่าฐานข้อมูล';return;}
  try{
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const storageKey='otop_mhs_2570_visitor_last_day';
    let already=false;
    try{already=localStorage.getItem(storageKey)===today;}catch(_e){}
    const func=already?'get_otop_view_count':'record_otop_view';
    const {data,error}=await O.client().rpc(func);
    if(error)throw error;
    if(typeof data!=='number'&&typeof data!=='string')throw Error('ไม่มีค่าจำนวนการเข้าชม');
    const value=Number(data);
    if(!Number.isFinite(value)||value<0)throw Error('ข้อมูลการเข้าชมไม่ถูกต้อง');
    el.textContent=new Intl.NumberFormat('th-TH').format(value);
    hint.textContent='ประมาณการ (หนึ่งครั้ง/เบราว์เซอร์/วัน)';
    if(!already)try{localStorage.setItem(storageKey,today);}catch(_e){}
  }catch(e){el.textContent='—';hint.textContent='ต้องติดตั้ง SQL ตัวนับก่อน';}
}
document.addEventListener('DOMContentLoaded',init);
