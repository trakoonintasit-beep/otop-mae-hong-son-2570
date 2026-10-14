'use strict';
const A=window.OTOP;const $=s=>document.querySelector(s);
let records=[];let editingId=null;let busy=false;let signedIn=false;
const SESSION_KEY='otop_mhs_2570_demo_session';
const setError=(id,msg)=>$(id).textContent=msg||'';

async function initAdmin(){
  $('#loginForm').addEventListener('submit',login);
  $('#logoutButton').addEventListener('click',logout);
  $('#addProduct').addEventListener('click',()=>openEditor());
  $('#exportData').addEventListener('click',exportData);
  $('#importDemo').addEventListener('click',()=>$('#importDemoFile').click());
  $('#importDemoFile').addEventListener('change',importDemo);
  $('#productForm').elements.namedItem('is_published').addEventListener('change',setPublishConsent);
  $('#closeEditor').addEventListener('click',closeEditor);
  $('#cancelEditor').addEventListener('click',closeEditor);
  $('#editorDialog').addEventListener('click',e=>{if(e.target===$('#editorDialog'))closeEditor();});
  $('#adminSearch').addEventListener('input',renderRows);
  $('#productForm').addEventListener('submit',saveProduct);
  $('#adminProductRows').addEventListener('click',async e=>{
    const edit=e.target.closest('[data-edit]');if(edit){openEditor(Number(edit.dataset.edit));return;}
    const del=e.target.closest('[data-delete]');if(del)await deleteProduct(Number(del.dataset.delete));
  });
  for(const [field,values] of [['category',A.CATEGORIES],['district',A.DISTRICTS]]) {
    $('#productForm').elements.namedItem(field).innerHTML='<option value="">เลือก...</option>'+values.map(x=>`<option value="${A.esc(x)}">${A.esc(x)}</option>`).join('');
  }
  if(A.configured){
    $('#demoNotice').hidden=true;$('#adminEmail').required=true;
    try {
      const {data,error}=await A.client().auth.getSession();if(error)throw error;
      if(data.session&&await isAdministrator(data.session.user))await showDashboard();
      else if(data.session)await A.client().auth.signOut();
    }catch(e){setError('#loginError','เชื่อมระบบยืนยันตัวตนไม่ได้: '+e.message);}
  }else{
    $('#demoNotice').hidden=false;
    $('#emailRow').hidden=true;
    const created=!!localStorage.getItem(A.DEMO_PW_KEY);
    $('#confirmRow').hidden=created;
    $('#loginHeading').textContent=created?'เข้าสู่ระบบสาธิต':'ตั้งรหัสผ่านสำหรับทดลอง';
    $('#loginSubtext').textContent=created?'ใช้รหัสผ่านที่คุณตั้งไว้บนเบราว์เซอร์นี้':'กำหนดรหัสผ่านทดลองอย่างน้อย 8 ตัวอักษร';
    $('#loginButton').textContent=created?'เข้าสู่ระบบสาธิต →':'ตั้งรหัสผ่านและเริ่มใช้งาน →';
    if(created&&sessionStorage.getItem(SESSION_KEY)==='active')await showDashboard();
  }
}
async function isAdministrator(user){
  if(!user)return false;
  const {data,error}=await A.client().from('admins').select('user_id').eq('user_id',user.id).maybeSingle();
  if(error)throw error;
  return !!data;
}
async function login(e){
  e.preventDefault();if(busy)return;
  busy=true;$('#loginButton').disabled=true;setError('#loginError','');
  try {
    const password=$('#adminPassword').value;
    if(password.length<8)throw new Error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
    if(A.configured){
      const email=$('#adminEmail').value.trim();if(!email)throw new Error('กรุณากรอกอีเมล');
      const {data,error}=await A.client().auth.signInWithPassword({email,password});
      if(error)throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      if(!await isAdministrator(data.user)){
        await A.client().auth.signOut();throw new Error('บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ กรุณาติดต่อผู้ดูแลฐานข้อมูล');
      }
    }else{
      const saved=localStorage.getItem(A.DEMO_PW_KEY);
      if(!saved){
        if(password!==$('#confirmPassword').value)throw new Error('รหัสผ่านยืนยันไม่ตรงกัน');
        const salt=Array.from(crypto.getRandomValues(new Uint8Array(16))).map(x=>x.toString(16).padStart(2,'0')).join('');
        const hash=await A.hashPassword(password,salt);
        localStorage.setItem(A.DEMO_PW_KEY,JSON.stringify({salt,hash}));
      }else{
        const {salt,hash}=JSON.parse(saved);
        const actual=await A.hashPassword(password,salt);
        if(actual!==hash)throw new Error('รหัสผ่านสาธิตไม่ถูกต้อง');
      }
      sessionStorage.setItem(SESSION_KEY,'active');
    }
    await showDashboard();$('#adminPassword').value='';
  }catch(err){setError('#loginError',err.message||'เข้าสู่ระบบไม่สำเร็จ');}
  finally{busy=false;$('#loginButton').disabled=false;}
}
async function showDashboard(){
  signedIn=true;
  $('#loginView').hidden=true;$('#dashboardView').hidden=false;
  $('#importDemo').hidden=A.configured;
  $('#modeBanner').innerHTML=A.configured?'<b>ระบบออนไลน์</b> – เข้าสู่ระบบผ่าน Supabase Auth และควบคุมสิทธิ์โดย Row Level Security':'<b>โหมดสาธิตเฉพาะเครื่อง</b> – เพิ่ม/แก้ไข/ลบในเบราว์เซอร์นี้เท่านั้น ไม่มีการแก้ไขข้อมูลบนเว็บของผู้ใช้อื่น และรหัสผ่านนี้ไม่ใช่การป้องกันฝั่งเซิร์ฟเวอร์';
  await refreshRecords();
}
async function logout(){
  if(A.configured)await A.client().auth.signOut();
  else sessionStorage.removeItem(SESSION_KEY);
  signedIn=false;records=[];
  $('#dashboardView').hidden=true;$('#loginView').hidden=false;
  if(!A.configured){
    $('#confirmRow').hidden=true;$('#loginHeading').textContent='เข้าสู่ระบบสาธิต';
    $('#loginButton').textContent='เข้าสู่ระบบสาธิต →';
  }
}
async function refreshRecords(){
  try {
    if(A.configured){
      const {data,error}=await A.client().from('products').select('*').order('id',{ascending:false});
      if(error)throw error;
      records=data||[];
    }else records=await A.allDemoProducts();
    renderRows();
  }catch(e){setError('#dashboardStatus','อ่านรายการสินค้าไม่สำเร็จ: '+e.message);}
}
function renderRows(){
  const term=$('#adminSearch').value.trim().toLowerCase();
  const arr=records.filter(p=>[p.name,p.producer,p.district,p.category,p.shop].join(' ').toLowerCase().includes(term));
  $('#statAll').textContent=records.length;
  $('#statLive').textContent=records.filter(p=>p.is_published!==false).length;
  $('#statFeatured').textContent=records.filter(p=>p.featured).length;
  $('#totalLabel').textContent=`จัดการข้อมูลสินค้า ${records.length} รายการ`;
  $('#listCount').textContent=`แสดง ${arr.length} รายการ`;
  $('#tableEmpty').hidden=arr.length>0;
  $('#adminProductRows').innerHTML=arr.map(p=>`<tr><td><div class="prod-id"><img src="${A.esc(A.imgUrl(p.image))}" alt=""><div><strong>${A.esc(p.name)}</strong><small>${A.esc(p.producer)}</small></div></div></td><td>${A.esc(A.canonicalCategory(p.category))}<small>${A.esc(p.district)}</small></td><td><b>${A.money(p.price)}</b></td><td><span class="state-tag ${p.is_published===false?'draft':'live'}">${p.is_published===false?'ยังไม่เผยแพร่':'เผยแพร่'}</span></td><td><div class="action-buttons"><button type="button" class="edit-btn" data-edit="${Number(p.id)}">แก้ไข</button><button type="button" class="delete-btn" data-delete="${Number(p.id)}">ลบ</button></div></td></tr>`).join('');
}
function openEditor(id=null){
  editingId=id;
  const form=$('#productForm');form.reset();setError('#editorError','');
  $('#dataPermission').checked=false;$('#imageUpload').value='';
  $('#editorTitle').textContent=id===null?'เพิ่มสินค้าใหม่':'แก้ไขข้อมูลสินค้า';
  form.elements.namedItem('is_published').checked=false;
  if(id!==null){
    const p=records.find(x=>Number(x.id)===id);if(!p)return;
    for(const field of ['name','category','district','price','unit','producer','shop','description','story','address','lat','lng','phone','line','facebook','image']){
      const el=form.elements.namedItem(field);el.value=field==='category'?A.canonicalCategory(p.category):(p[field]??'');
    }
    form.elements.namedItem('featured').checked=!!p.featured;
    form.elements.namedItem('is_published').checked=p.is_published!==false;
  }
  setPublishConsent();
  $('#editorDialog').showModal();
  form.elements.namedItem('name').focus();
}
function closeEditor(){if(!busy)$('#editorDialog').close();}
function setPublishConsent(){
  const publish=$('#productForm').elements.namedItem('is_published').checked;
  $('#dataPermission').required=publish;
}
function validUrl(u){return !u||/^https:\/\//i.test(u);}
function collectForm(){
  const fd=new FormData($('#productForm'));
  const text=k=>String(fd.get(k)||'').trim();
  const rawLat=text('lat'),rawLng=text('lng');
  if(fd.has('is_published')&&!$('#dataPermission').checked)throw new Error('กรุณายืนยันสิทธิ์ในการเผยแพร่ข้อมูลก่อน');
  if((rawLat&&!rawLng)||(!rawLat&&rawLng))throw new Error('กรุณากรอกพิกัดละติจูดและลองจิจูดให้ครบคู่กัน');
  if(rawLat&&(Number(rawLat)<-90||Number(rawLat)>90||Number(rawLng)<-180||Number(rawLng)>180))throw new Error('พิกัดร้านค้าไม่อยู่ในช่วงที่ถูกต้อง');
  for(const field of ['line','facebook'])if(!validUrl(text(field)))throw new Error('ลิงก์ '+field+' ต้องขึ้นต้นด้วย https://');
  if(!validUrl(text('image'))&&!/^assets\/images\/[a-z0-9_.-]+\.(png|jpg|jpeg|webp)$/i.test(text('image'))&&!/^data:image\//i.test(text('image')))throw new Error('รูปภาพต้องเป็น HTTPS หรือ path ที่อยู่ใน assets/images');
  const number=Number(text('price'));
  if(!Number.isFinite(number)||number<0||number>10000000)throw new Error('ราคาสินค้าไม่ถูกต้อง');
  return {
    name:text('name'),category:text('category'),district:text('district'),price:number,
    unit:text('unit'),producer:text('producer'),shop:text('shop'),description:text('description'),story:text('story'),
    address:text('address'),lat:rawLat?Number(rawLat):null,lng:rawLng?Number(rawLng):null,
    phone:text('phone'),line:text('line'),facebook:text('facebook'),image:text('image')||'assets/images/hero-mae-hong-son.webp',
    featured:fd.has('featured'),is_published:fd.has('is_published')
  };
}
async function uploadedImage(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('อนุญาตเฉพาะ JPEG, PNG และ WebP');
  if(file.size>5*1024*1024)throw new Error('รูปภาพต้องไม่เกิน 5 MB');
  if(A.configured){
    const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
    const filePath=`products/${crypto.randomUUID()}.${ext}`;
    const {error}=await A.client().storage.from('product-images').upload(filePath,file,{contentType:file.type,upsert:false});
    if(error)throw error;
    return A.client().storage.from('product-images').getPublicUrl(filePath).data.publicUrl;
  }
  // Local demo only: resize and compress to avoid browser storage quota.
  const bitmap=await createImageBitmap(file);
  const scale=Math.min(1,840/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
  return canvas.toDataURL('image/jpeg',0.7);
}
async function saveProduct(e){
  e.preventDefault();if(busy||!signedIn)return;
  busy=true;$('#saveProduct').disabled=true;setError('#editorError','');
  try{
    const payload=collectForm();
    const file=$('#imageUpload').files[0];if(file)payload.image=await uploadedImage(file);
    if(A.configured){
      let result;
      if(editingId===null) result=await A.client().from('products').insert(payload).select().single();
      else result=await A.client().from('products').update(payload).eq('id',editingId).select().single();
      if(result.error)throw result.error;
    }else{
      let copy=[...records];
      if(editingId===null){const newId=Math.max(0,...copy.map(p=>Number(p.id)||0))+1;copy.unshift({id:newId,...payload});}
      else copy=copy.map(p=>Number(p.id)===editingId?{...p,...payload}:p);
      A.saveDemoProducts(copy);
    }
    $('#editorDialog').close();
    await refreshRecords();
    setError('#dashboardStatus','บันทึกสำเร็จ'+(A.configured?' — ข้อมูลอัปเดตในฐานข้อมูลออนไลน์':' — เฉพาะเบราว์เซอร์นี้'));
  }catch(err){setError('#editorError','บันทึกไม่สำเร็จ: '+(err.message||err));}
  finally{busy=false;$('#saveProduct').disabled=false;}
}
async function deleteProduct(id){
  if(!signedIn||busy)return;
  const p=records.find(x=>Number(x.id)===id);if(!p)return;
  if(!confirm(`ต้องการลบ “${p.name}” หรือไม่?\nรายการที่ลบจะกู้คืนจากหน้านี้ไม่ได้`))return;
  busy=true;
  try{
    if(A.configured){const {error}=await A.client().from('products').delete().eq('id',id);if(error)throw error;}
    else A.saveDemoProducts(records.filter(x=>Number(x.id)!==id));
    await refreshRecords();setError('#dashboardStatus','ลบสินค้าเรียบร้อยแล้ว');
  }catch(e){setError('#dashboardStatus','ลบไม่สำเร็จ: '+e.message);}finally{busy=false;}
}
// Backup/export includes sensitive contact data: requires an explicit user action.
function exportData(){
  if(!signedIn||busy)return;
  if(!confirm('ดาวน์โหลดไฟล์สำรองสินค้า? ไฟล์นี้อาจมีเบอร์โทรและพิกัดร้านค้า กรุณาเก็บอย่างปลอดภัยและอย่าอัปโหลดไป GitHub สาธารณะ'))return;
  const data={format:'otop-mhs-products-backup-v1',exported_at:new Date().toISOString(),mode:A.configured?'online':'demo',products:records};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='otop-mae-hong-son-backup-'+new Date().toISOString().slice(0,10)+'.json';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  setError('#dashboardStatus','ส่งออกไฟล์สำรองเรียบร้อยแล้ว กรุณาจัดเก็บอย่างปลอดภัย');
}
async function importDemo(e){
  if(!signedIn||busy||A.configured)return;
  const input=e.currentTarget,file=input.files?.[0];if(!file)return;
  try{
    if(file.size>2*1024*1024)throw new Error('ไฟล์สำรองใหญ่เกิน 2 MB');
    const obj=JSON.parse(await file.text()),rows=Array.isArray(obj)?obj:obj.products;
    if(!Array.isArray(rows)||rows.length>1000)throw new Error('ไฟล์สำรองต้องเป็นรายการสินค้าไม่เกิน 1,000 รายการ');
    const ids=new Set();
    const cleaned=rows.map((p,i)=>{
      p={...p,category:A.canonicalCategory(p.category)};
      if(!p||typeof p!=='object'||!String(p.name||'').trim()||!A.CATEGORIES.includes(p.category)||!A.DISTRICTS.includes(p.district))throw new Error('ข้อมูลรายการที่ '+(i+1)+' ไม่ถูกต้อง');
      if(!Number.isFinite(Number(p.price))||Number(p.price)<0||Number(p.price)>10000000)throw new Error('ราคาสินค้ารายการที่ '+(i+1)+' ไม่ถูกต้อง');
      const id=Number(p.id);if(!Number.isSafeInteger(id)||id<1||ids.has(id))throw new Error('รหัสสินค้าซ้ำหรือไม่ถูกต้อง');ids.add(id);
      if(p.image&&!(/^https:\/\//i.test(String(p.image))||/^assets\/images\/[a-z0-9_.-]+\.(png|webp|jpeg|jpg)$/i.test(String(p.image))||/^data:image\/(?:png|jpeg|webp);base64,/i.test(String(p.image))))throw new Error('รูปภาพรายการที่ '+(i+1)+' ไม่ถูกต้อง');
      const str=k=>String(p[k]??'').slice(0,k==='description'||k==='story'?3000:400);
      if(['line','facebook'].some(k=>str(k)&&!/^https:\/\//i.test(str(k))))throw new Error('ลิงก์ติดต่อไม่ถูกต้อง');
      const lat=p.lat==null||p.lat===''?null:Number(p.lat),lng=p.lng==null||p.lng===''?null:Number(p.lng);
      if((lat===null)!==(lng===null)||lat!==null&&(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180))throw new Error('พิกัดไม่ถูกต้อง');
      return {id,name:str('name'),category:p.category,district:p.district,price:Number(p.price),unit:str('unit'),producer:str('producer'),shop:str('shop'),description:str('description'),story:str('story'),address:str('address'),phone:str('phone'),line:str('line'),facebook:str('facebook'),image:str('image'),lat,lng,featured:!!p.featured,is_published:!!p.is_published};
    });
    if(!confirm('นำเข้า '+cleaned.length+' รายการและแทนที่ข้อมูลสาธิตทั้งหมดในเบราว์เซอร์นี้?'))return;
    A.saveDemoProducts(cleaned);await refreshRecords();setError('#dashboardStatus','นำเข้าข้อมูลสาธิตสำเร็จ '+cleaned.length+' รายการ');
  }catch(err){setError('#dashboardStatus','นำเข้าไม่ได้: '+(err.message||err));}
  finally{input.value='';}
}
document.addEventListener('DOMContentLoaded',initAdmin);
