'use strict';
const O = window.OTOP;
const $ = selector => document.querySelector(selector);
let products = []; let filtered = []; let map; let markers=[];

async function loadProducts() {
  try {
    products = await O.sourceProducts();
    $('#totalProducts').textContent = products.length;
    $('#dataBadgeTitle').textContent = O.configured ? 'ข้อมูลออนไลน์' : 'ข้อมูลสาธิต';
    $('#mapDescription').textContent = O.configured ? 'แสดงพิกัดร้านค้าจากข้อมูลที่ผู้ดูแลได้อนุญาตเผยแพร่' : 'หมุดทั้งหมดเป็นพิกัดสาธิตระดับอำเภอ ไม่ใช่ตำแหน่งร้านจริง';
    $('#dataBadge').textContent = O.configured ? 'ข้อมูลจากฐานข้อมูลออนไลน์ ตรวจสอบข้อมูลกับผู้ผลิตก่อนใช้' : 'การแก้ไขในโหมดสาธิตบันทึกเฉพาะเบราว์เซอร์นี้';
    $('#categoryFilter').innerHTML = '<option value="">ทุกหมวด</option>' + O.CATEGORIES.map(v=>`<option value="${O.esc(v)}">${O.esc(v)}</option>`).join('');
    $('#districtFilter').innerHTML = '<option value="">ทุกอำเภอ</option>' + O.DISTRICTS.map(v=>`<option value="${O.esc(v)}">${O.esc(v)}</option>`).join('');
    applyFilters();
  } catch(error) {
    $('#resultCount').textContent = 'เกิดข้อผิดพลาด';
    $('#productGrid').innerHTML = `<p class="error-note" role="alert">โหลดสินค้าไม่สำเร็จ: ${O.esc(error.message)}</p>`;
  }
}
function init() {
  for (const selector of ['#searchInput','#categoryFilter','#districtFilter','#sortFilter']) {
    $(selector).addEventListener(selector === '#searchInput' ? 'input' : 'change', applyFilters);
  }
  $('#clearFilters').addEventListener('click', resetFilters);
  $('#showAllMarkers').addEventListener('click',resetFilters);
  $('#closeDialog').addEventListener('click',()=>$('#productDialog').close());
  $('#productDialog').addEventListener('click',e=>{if(e.target === $('#productDialog'))$('#productDialog').close();});
  $('#productGrid').addEventListener('click',e=>{const b=e.target.closest('[data-product-id]');if(b)openProduct(Number(b.dataset.productId));});
  $('#dialogContent').addEventListener('click',e=>{const b=e.target.closest('[data-map-product]');if(b)focusOnMap(Number(b.dataset.mapProduct));});
  $('#mapList').addEventListener('click',e=>{const b=e.target.closest('[data-shop-index]');if(b)focusShop(Number(b.dataset.shopIndex));});
  initMap(); loadProducts();
  window.addEventListener('storage', e=> { if(e.key===O.STORAGE_KEY)loadProducts(); });
  window.addEventListener('focus',()=>{if(!O.configured)loadProducts();});
}
function resetFilters(){ $('#searchInput').value='';$('#categoryFilter').value='';$('#districtFilter').value='';$('#sortFilter').value='featured';applyFilters();}
function applyFilters() {
  const q=$('#searchInput').value.trim().toLowerCase();const cat=$('#categoryFilter').value;const dist=$('#districtFilter').value;
  filtered=products.filter(p => {
    const hay=[p.name,p.category,p.district,p.producer,p.shop,p.description,p.story,p.address].join(' ').toLowerCase();
    return (!q||hay.includes(q)) && (!cat||p.category===cat) && (!dist||p.district===dist);
  });
  const sort=$('#sortFilter').value;
  filtered.sort((a,b)=>sort==='priceAsc'?a.price-b.price:sort==='priceDesc'?b.price-a.price:sort==='name'?String(a.name).localeCompare(b.name,'th'):(Number(b.featured)-Number(a.featured)||Number(a.id)-Number(b.id)));
  renderProducts(); renderMapMarkers();
}
function renderProducts(){
  $('#resultCount').textContent=`พบ ${filtered.length} รายการ`;
  $('#emptyState').hidden=filtered.length>0;
  $('#productGrid').innerHTML=filtered.map(p => `<article class="product-card"><img class="product-image" loading="lazy" src="${O.esc(O.imgUrl(p.image))}" alt="ภาพประกอบ ${O.esc(p.name)}"><div class="product-body"><div class="chips"><span class="chip">${O.esc(p.category)}</span>${p.featured?'<span class="chip featured">แนะนำ</span>':''}</div><h3>${O.esc(p.name)}</h3><div class="product-meta">${O.esc(p.district)} · ${O.esc(p.producer)}</div><div class="product-foot"><div class="price">${O.money(p.price)} <small>/ ${O.esc(p.unit)}</small></div><button class="text-btn" data-product-id="${Number(p.id)}" type="button">ดูรายละเอียด →</button></div></div></article>`).join('');
}
function openProduct(id){
  const p=products.find(row=>Number(row.id)===id);if(!p)return;
  const google=O.gmap(p.lat,p.lng),fb=O.externalUrl(p.facebook),line=O.externalUrl(p.line),tel=O.whatsappPhone(p.phone);
  const links=[google?`<a href="${google}" target="_blank" rel="noopener noreferrer">เปิดเส้นทาง Google Maps</a>`:'',tel?`<a href="tel:${O.esc(tel)}">โทร ${O.esc(p.phone)}</a>`:'',line?`<a href="${O.esc(line)}" target="_blank" rel="noopener noreferrer">ติดต่อ LINE</a>`:'',fb?`<a href="${O.esc(fb)}" target="_blank" rel="noopener noreferrer">Facebook</a>`:'',google?`<button type="button" class="secondary" data-map-product="${id}">ดูบนแผนที่</button>`:''].join('');
  $('#dialogContent').innerHTML=`<div class="dialog-layout"><img src="${O.esc(O.imgUrl(p.image))}" alt="ภาพประกอบ ${O.esc(p.name)}"><div class="dialog-info"><div class="chips"><span class="chip">${O.esc(p.category)}</span><span class="chip">${O.esc(p.district)}</span></div><h2>${O.esc(p.name)}</h2><div class="price">${O.money(p.price)} <small>/ ${O.esc(p.unit)}</small></div><p>${O.esc(p.description)}</p><div class="details"><div class="detail"><small>ผู้ผลิต</small><b>${O.esc(p.producer)}</b></div><div class="detail"><small>ร้าน</small><b>${O.esc(p.shop)}</b></div><div class="detail"><small>ที่ตั้ง</small><b>${O.esc(p.address||p.district)}</b></div><div class="detail"><small>สถานะข้อมูล</small><b>${O.configured?'ฐานข้อมูลออนไลน์':'สาธิต'}</b></div></div><h3>เรื่องราวสินค้า</h3><p>${O.esc(p.story)}</p><div class="notice">${O.configured?'ติดต่อผู้ผลิตเพื่อยืนยันข้อมูลและราคาล่าสุดก่อนสั่งซื้อ':'ข้อมูลในโหมดสาธิต ไม่ใช่ข้อมูลร้านค้าจริง'}</div><div class="dialog-actions">${links||'<span>ยังไม่มีข้อมูลติดต่อ</span>'}</div></div></div>`;
  $('#productDialog').showModal();
}
function initMap(){
  if(!window.L){$('#map').textContent='ไม่สามารถโหลดแผนที่ได้';return;}
  map=L.map('map',{scrollWheelZoom:false}).setView([18.9,98],8);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
  setTimeout(()=>map.invalidateSize(),150);
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
    const popup=document.createElement('div');
    const b=document.createElement('b');b.textContent=s.shop;popup.append(b,document.createElement('br'),document.createTextNode(s.district));
    const line=document.createElement('div');line.textContent=s.items.map(x=>x.name).join(' · ');popup.append(line);
    const marker=L.marker([s.lat,s.lng]).addTo(map).bindPopup(popup);
    const i=markers.length;markers.push({data:s,marker});
    list.push(`<button class="map-item" type="button" data-shop-index="${i}"><b>${O.esc(s.shop)}</b><span>${O.esc(s.district)} · ${s.items.length} สินค้า</span><span>${O.esc(s.items.map(x=>x.name).join(' · '))}</span></button>`);
  });
  $('#mapList').innerHTML=list.join('')||'<p class="notice">ไม่พบร้านที่มีพิกัดในรายการนี้</p>';
  if(markers.length)map.fitBounds(L.featureGroup(markers.map(x=>x.marker)).getBounds().pad(.2),{maxZoom:10});
}
function focusShop(i){const x=markers[i];if(!x)return;map.setView([x.data.lat,x.data.lng],11);x.marker.openPopup();$('#map-section').scrollIntoView({behavior:'smooth'});}
function focusOnMap(id){const p=products.find(x=>Number(x.id)===id);if(!p)return;$('#productDialog').close();const i=markers.findIndex(x=>x.data.shop===p.shop&&x.data.lat===Number(p.lat));if(i>=0)focusShop(i);else $('#map-section').scrollIntoView({behavior:'smooth'});}
document.addEventListener('DOMContentLoaded',init);
