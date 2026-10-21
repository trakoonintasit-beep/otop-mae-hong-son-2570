(()=>{'use strict';const O=window.OTOP,$=id=>document.getElementById(id),msg=(s,e=false)=>{$('message').textContent=s;$('message').classList.toggle('error',e);};let officer=null,products=[],requests=[];
const esc=O.esc;
async function auth(){if(!O.configured)throw Error('ระบบต้องเชื่อม Supabase');const a=await O.client().auth.getUser();if(a.error||!a.data?.user)throw Error('กรุณาเข้าสู่ระบบ Admin ก่อน');let r=await O.client().from('admins').select('role,district,is_active').eq('user_id',a.data.user.id).single();if(r.error||!r.data?.is_active||r.data.role!=='district_officer')throw Error('หน้านี้สำหรับเจ้าหน้าที่ประจำอำเภอที่ได้รับสิทธิ์เท่านั้น');if(!O.DISTRICTS.includes(r.data.district))throw Error('บัญชียังไม่ได้รับการมอบหมายอำเภอ');officer={...r.data,user_id:a.data.user.id};$('myDistrict').textContent=r.data.district;}
async function load(){const a=await O.client().from('products').select('*').eq('district',officer.district).order('id',{ascending:false});if(a.error)throw a.error;products=a.data||[];
 const b=await O.client().from('otop_district_requests').select('id,product_id,action,status,submitted_at,review_note,payload,published_product_id').eq('submitted_by',officer.user_id).eq('district',officer.district).order('submitted_at',{ascending:false}).limit(100);if(b.error)throw b.error;requests=b.data||[];
 $('myCount').textContent=products.length;$('pending').textContent=requests.filter(x=>x.status==='pending').length;$('approved').textContent=requests.filter(x=>x.status==='approved').length;
 $('productId').innerHTML=products.map(p=>`<option value="${p.id}">#${p.id} · ${esc(p.name)}</option>`).join('');
 $('products').innerHTML=products.map(p=>`<tr><td>${esc(p.name)}</td><td>${O.money(p.price)}</td><td><span class="tag">${p.is_published?'เผยแพร่':'ร่าง'}</span></td><td><button class="btn secondary" type="button" data-edit="${p.id}">เสนอแก้ไข</button></td></tr>`).join('')||'<tr><td colspan="4">ยังไม่มีสินค้า</td></tr>';
 $('requests').innerHTML=requests.map(r=>`<article class="request"><header><strong>#${r.id} · ${esc(r.payload?.name||'สินค้า')}</strong><span class="tag ${esc(r.status)}">${r.status==='pending'?'รออนุมัติ':r.status==='approved'?'อนุมัติแล้ว':'ตีกลับ'}</span></header><p>${r.action==='create'?'เพิ่มสินค้า':'แก้ไขสินค้า'} · ${new Date(r.submitted_at).toLocaleDateString('th-TH')}</p>${r.review_note?`<p>หมายเหตุ: ${esc(r.review_note)}</p>`:''}</article>`).join('')||'<p class="muted">ยังไม่มีคำขอ</p>';
}
function setForm(p){for(const el of $('requestForm').elements){if(!el.name)continue;el.value=p?.[el.name]??(el.name==='unit'?'ชิ้น':'');}if(p)$('productId').value=p.id;}
function toggleMode(){const edit=$('requestMode').value==='update';$('editProductWrap').hidden=!edit;if(edit){if(products.length){const p=products.find(x=>String(x.id)===$('productId').value)||products[0];setForm(p);}else msg('ยังไม่มีสินค้าที่เลือกแก้ไข',true);}else setForm(null);}
async function submit(e){e.preventDefault();const btn=$('submitRequest');btn.disabled=true;try{
 if(!$('officerConsent').checked)throw Error('กรุณายืนยันการอนุญาตใช้ข้อมูลและภาพสินค้า');
 const mode=$('requestMode').value;const p=products.find(x=>String(x.id)===$('productId').value);if(mode==='update'&&!p)throw Error('กรุณาเลือกสินค้าในอำเภอ');
 const form=new FormData($('requestForm'));const fields=['name','category','price','unit','producer','shop','description','story','address','phone','line','facebook','image','lat','lng'];let payload={};for(const field of fields)payload[field]=String(form.get(field)||'').trim();
 if(!O.CATEGORIES.includes(payload.category))throw Error('กรุณาเลือกประเภทสินค้า');if(!payload.name||!payload.producer||!payload.shop)throw Error('กรุณากรอกชื่อสินค้า ผู้ผลิต และจุดจำหน่าย');
 if(!Number.isFinite(Number(payload.price))||Number(payload.price)<0)throw Error('ราคาไม่ถูกต้อง');
 if(Boolean(payload.lat)!==Boolean(payload.lng))throw Error('ต้องกรอกพิกัดละติจูดและลองจิจูดเป็นคู่');
 const image=$('productImage').files[0];if(image){msg('กำลังอัปโหลดรูปไป Google Drive…');payload.image=(await window.OTOP_DRIVE.upload(image,'products')).image_url;}
 if(!window.confirm('ยืนยันส่ง'+(mode==='create'?'สินค้าใหม่':'คำขอแก้ไขสินค้า')+'ของอำเภอ'+officer.district+' เพื่อให้ Admin หลักพิจารณา?'))return;
 const insert={district:officer.district,action:mode,product_id:mode==='update'?Number(p.id):null,payload,status:'pending',submitted_by:officer.user_id};
 const r=await O.client().from('otop_district_requests').insert(insert).select('id').single();if(r.error)throw r.error;
 msg('ส่งคำขอ #'+r.data.id+' สำเร็จ รอ Admin หลักตรวจสอบ');await load();
 }catch(err){msg('ส่งคำขอไม่สำเร็จ: '+(err.message||err),true);}finally{btn.disabled=false;}}
async function start(){try{await auth();$('category').innerHTML='<option value="">เลือกหมวด</option>'+O.CATEGORIES.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');$('requestMode').addEventListener('change',toggleMode);$('productId').addEventListener('change',()=>setForm(products.find(x=>String(x.id)===$('productId').value)));
 $('products').addEventListener('click',e=>{const b=e.target.closest('[data-edit]');if(!b)return;$('requestMode').value='update';$('productId').value=b.dataset.edit;toggleMode();$('requestForm').scrollIntoView({behavior:'smooth',block:'start'});});
 $('requestForm').addEventListener('submit',submit);$('requestForm').addEventListener('reset',()=>setTimeout(toggleMode,0));await load();$('workspace').hidden=false;msg('เข้าสู่ระบบเจ้าหน้าที่อำเภอ'+officer.district+' · ส่งคำขออนุมัติได้แล้ว');
 }catch(err){msg('ไม่สามารถใช้งานหน้านี้: '+(err.message||err),true);}}
document.addEventListener('DOMContentLoaded',start);
})();
