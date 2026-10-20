'use strict';
const A=window.OTOP;const $=s=>document.querySelector(s);
let records=[];let editingId=null;let busy=false;let signedIn=false;
let currentRole='sub_admin';let accountRows=[];let activeResetUser=null;
const SUB_ACCOUNT_SUFFIX='@accounts.otop-admin.example.com';
const SESSION_KEY='otop_mhs_2570_demo_session';
const setError=(id,msg)=>$(id).textContent=msg||'';

async function initAdmin(){
  $('#loginForm').addEventListener('submit',login);
  // Password visibility is only local to the current input; nothing is stored or retrieved.
  document.addEventListener('click',e=>{
    const button=e.target.closest('[data-toggle-password]');
    if(!button)return;
    const input=document.getElementById(button.dataset.togglePassword);
    if(!input)return;
    const reveal=input.type==='password';
    input.type=reveal?'text':'password';
    button.textContent=reveal?'ซ่อน':'แสดง';
    button.setAttribute('aria-pressed',String(reveal));
    button.setAttribute('aria-label',reveal?'ซ่อนรหัสผ่าน':'แสดงรหัสผ่าน');
  });
  $('#checkAdminConnection').addEventListener('click',checkAdminConnection);
  $('#tabProducts').addEventListener('click',()=>switchAdminTab('products'));
  $('#tabAccounts').addEventListener('click',()=>switchAdminTab('accounts'));
  $('#tabSite').addEventListener('click',()=>switchAdminTab('site'));
  $('#createAccountForm').addEventListener('submit',createSubAdmin);
  $('#refreshAccounts').addEventListener('click',refreshSubAdmins);
  $('#accountRows').addEventListener('click',handleAccountActions);
  $('#resetPasswordForm').addEventListener('submit',resetSubAdminPassword);
  $('#closeResetPassword').addEventListener('click',()=>$('#resetPasswordDialog').close());
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
  let {data,error}=await A.client().from('admins').select('user_id, role, is_active').eq('user_id',user.id).maybeSingle();
  // Before migration, allow an existing admin to continue using the product editor,
  // but do not grant the master role until the migration is explicitly completed.
  if(error && (error.code==='42703' || error.message?.includes('does not exist'))){
    const old=await A.client().from('admins').select('user_id').eq('user_id',user.id).maybeSingle();
    data=old.data;error=old.error;currentRole='sub_admin';
  }else currentRole=data?.role==='master_admin'?'master_admin':'sub_admin';
  if(error)throw error;
  return !!data && data.is_active!==false;
}
async function login(e){
  e.preventDefault();if(busy)return;
  busy=true;$('#loginButton').disabled=true;setError('#loginError','');
  try {
    const password=$('#adminPassword').value;
    if(password.length<8)throw new Error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
    if(A.configured){
      const identifier=$('#adminEmail').value.trim().toLowerCase();
      if(!identifier)throw new Error('กรุณากรอกอีเมล หรือ Username');
      if(!identifier.includes('@')&&!/^[a-z][a-z0-9_.-]{3,23}$/.test(identifier))throw new Error('Username ต้องเป็นภาษาอังกฤษ 4–24 ตัวอักษร');
      const email=identifier.includes('@')?identifier:identifier+SUB_ACCOUNT_SUFFIX;
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
  $('#adminTabs').hidden=!A.configured||currentRole!=='master_admin';
  switchAdminTab('products');
  $('#modeBanner').innerHTML=A.configured?'<b>ระบบออนไลน์</b> – เข้าสู่ระบบผ่าน Supabase Auth และควบคุมสิทธิ์โดย Row Level Security':'<b>โหมดสาธิตเฉพาะเครื่อง</b> – เพิ่ม/แก้ไข/ลบในเบราว์เซอร์นี้เท่านั้น ไม่มีการแก้ไขข้อมูลบนเว็บของผู้ใช้อื่น และรหัสผ่านนี้ไม่ใช่การป้องกันฝั่งเซิร์ฟเวอร์';
  await refreshRecords();
}
async function logout(){
  if(A.configured)await A.client().auth.signOut();
  else sessionStorage.removeItem(SESSION_KEY);
  signedIn=false;records=[];currentRole='sub_admin';switchAdminTab('products');
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

// Master-only access: visible menus are for usability. The database and Edge Function
// make the actual access-control decision independently on the server.
function switchAdminTab(which){
  const master=A.configured&&signedIn&&currentRole==='master_admin';
  const accounts=which==='accounts'&&master;
  const site=which==='site'&&master;
  document.querySelectorAll('.product-pane').forEach(el=>{el.hidden=accounts||site;});
  $('#accountsPanel').hidden=!accounts;
  $('#siteEditorPanel').hidden=!site;
  for (const [id,enabled] of [['tabProducts',!accounts&&!site],['tabAccounts',accounts],['tabSite',site]]) {
    const btn=$('#'+id);btn.classList.toggle('is-active',enabled);
    if(enabled)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current');
  }
  if(accounts)refreshSubAdmins();
  if(site)window.OTOP_SITE_ADMIN?.activate();
}
function checkStrongPassword(password){
  if(password.length<12||password.length>128||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password))
    throw new Error('รหัสผ่านต้องมี 12–128 ตัวอักษร และประกอบด้วยตัวอักษรภาษาอังกฤษกับตัวเลข');
}
async function adminOperation(body){
  if(!A.configured||!signedIn||currentRole!=='master_admin')
    throw new Error('เฉพาะ Admin หลักเท่านั้นที่จัดการบัญชีได้');

  // Check the authenticated session before invoking Edge Functions.
  // Do not expose access tokens or passwords in errors, logs, or localStorage.
  const {data:auth,error:sessionError}=await A.client().auth.getSession();
  if(sessionError||!auth?.session?.access_token)
    throw new Error('เซสชันหมดอายุ กรุณาออกจากระบบและเข้าสู่ระบบใหม่');

  let outcome;
  try{
    outcome=await A.client().functions.invoke('manage-otop-admins',{body});
  }catch(err){
    throw new Error('ไม่สามารถเชื่อมต่อ Supabase ได้ กรุณาตรวจอินเทอร์เน็ตและ URL ของ Project');
  }
  const {data,error}=outcome;
  if(error){
    const response=error.context;
    const status=Number(response?.status)||0;
    let serverMessage='';
    // Supabase FunctionsHttpError.context is a Response, whereas
    // FunctionsFetchError/RelayError may carry a native Error.
    try{
      if(typeof response?.clone==='function'){
        const text=await response.clone().text();
        if(text){
          let payload;
          try{payload=JSON.parse(text);}catch{}
          serverMessage=String(payload?.error||payload?.message||'').slice(0,180);
        }
      }
    }catch{}

    if(status===404 || /not.found|function.not.found/i.test(serverMessage))
      throw new Error('ไม่พบ Edge Function manage-otop-admins (404) — ต้อง Deploy ฟังก์ชันใน Supabase Project ที่เว็บใช้อยู่');
    if(status===401)
      throw new Error('ระบบปฏิเสธการยืนยันตัวตน (401) — ลองออกและเข้าใหม่ และตรวจการตั้งค่า Verify JWT ของ Edge Function');
    if(status===403)
      throw new Error(serverMessage==='Origin is not allowed'
        ? 'โดเมนเว็บไซต์ไม่ได้รับอนุญาต (403) — ตรวจ OTOP_ALLOWED_ORIGINS ของ Edge Function'
        : 'ไม่ได้รับอนุญาต (403) — ตรวจ role=master_admin และ is_active=true ใน Supabase');
    if(status===500||status===503)
      throw new Error('Edge Function เกิดปัญหา ('+status+') — ตรวจ Invocations / Logs ใน Supabase และ SQL migration');
    if(status===429)
      throw new Error('มีการเรียกใช้งานมากเกินไป (429) — โปรดรอสักครู่แล้วลองใหม่');
    if(!status)
      throw new Error('ติดต่อ Edge Function ไม่สำเร็จ (เครือข่าย/CORS) — ตรวจว่า Deploy แล้ว ใช้ Supabase Project ถูกตัว และอนุญาตโดเมน GitHub Pages');
    throw new Error('Edge Function ตอบกลับผิดพลาด ('+status+')'+(serverMessage?': '+serverMessage:''));
  }
  if(!data?.ok)throw new Error(data?.error||'ระบบจัดการ Admin ไม่ยืนยันผลสำเร็จ');
  return data;
}
async function checkAdminConnection(){
  const button=$('#checkAdminConnection');
  const output='#accountActionMessage';
  button.disabled=true;
  setError(output,'กำลังตรวจสอบการเชื่อมต่อ Edge Function…');
  try{
    await adminOperation({action:'list'});
    setError(output,'✓ เชื่อมต่อสำเร็จ ระบบจัดการ Admin พร้อมใช้งาน');
  }catch(err){setError(output,'✕ '+(err.message||err));}
  finally{button.disabled=false;}
}
async function createSubAdmin(e){
  e.preventDefault();
  const form=e.currentTarget;
  if(!form.reportValidity())return;
  const display_name=$('#newAdminName').value.trim();
  const username=$('#newAdminUsername').value.trim().toLowerCase();
  const password=$('#newAdminPassword').value;
  const confirmation=$('#newAdminConfirm').value;
  try{
    if(!/^[a-z][a-z0-9_.-]{3,23}$/.test(username))throw new Error('Username ไม่ถูกต้อง');
    if(display_name.length<2||display_name.length>100)throw new Error('โปรดระบุชื่อเจ้าหน้าที่ 2–100 ตัวอักษร');
    checkStrongPassword(password);
    if(password!==confirmation)throw new Error('ยืนยันรหัสผ่านไม่ตรงกัน');
    if(!$('#accountApproval').checked)throw new Error('กรุณายืนยันสิทธิ์การสร้างบัญชี');
    if(!confirm('ยืนยันสร้าง Admin รองชื่อ '+username+'?\nเจ้าหน้าที่คนนี้จะเพิ่ม แก้ไข และลบข้อมูลสินค้าได้'))return;
    $('#submitNewAdmin').disabled=true;setError('#accountCreateMessage','กำลังสร้างบัญชี...');
    await adminOperation({action:'create',username,display_name,password});
    form.reset();setError('#accountCreateMessage','สร้างบัญชี '+username+' สำเร็จ กรุณาส่ง Username/Password ให้เจ้าหน้าที่ผ่านช่องทางส่วนตัวที่ปลอดภัย');
    await refreshSubAdmins();
  }catch(err){setError('#accountCreateMessage','สร้างบัญชีไม่สำเร็จ: '+(err.message||err));}
  finally{$('#newAdminPassword').value='';$('#newAdminConfirm').value='';$('#submitNewAdmin').disabled=false;}
}
async function refreshSubAdmins(){
  if(!A.configured||currentRole!=='master_admin'||!signedIn)return;
  $('#accountRows').innerHTML='<p class="muted">กำลังโหลดบัญชี...</p>';
  try{
    const data=await adminOperation({action:'list'});
    accountRows=data.accounts||[];renderSubAdmins();
  }catch(err){$('#accountRows').innerHTML='<p class="form-error">'+A.esc('โหลดบัญชีไม่สำเร็จ: '+(err.message||err))+'</p>';}
}
function renderSubAdmins(){
  if(!accountRows.length){$('#accountRows').innerHTML='<p class="muted">ยังไม่มีบัญชี Admin รอง</p>';return;}
  $('#accountRows').innerHTML=accountRows.map(row=>{
    const id=A.esc(row.user_id),status=row.is_active!==false;
    return '<article class="account-item"><div><b>'+A.esc(row.display_name||row.username)+'</b><small>Username: '+A.esc(row.username)+'</small><span class="account-status'+(status?'':' is-disabled')+'">'+(status?'เปิดใช้งาน':'ระงับสิทธิ์')+'</span></div><div class="account-actions"><button class="admin-secondary" data-reset-admin="'+id+'" type="button">เปลี่ยนรหัส</button><button class="admin-secondary" data-toggle-admin="'+id+'" type="button">'+(status?'ปิดสิทธิ์':'เปิดสิทธิ์')+'</button></div></article>';
  }).join('');
}
async function handleAccountActions(e){
  const reset=e.target.closest('[data-reset-admin]');
  if(reset){
    const row=accountRows.find(r=>r.user_id===reset.dataset.resetAdmin);if(!row)return;
    activeResetUser=row.user_id;$('#resetAccountName').textContent='บัญชี: '+row.username;
    $('#resetPasswordForm').reset();setError('#resetPasswordError','');$('#resetPasswordDialog').showModal();return;
  }
  const toggle=e.target.closest('[data-toggle-admin]');if(!toggle)return;
  const row=accountRows.find(r=>r.user_id===toggle.dataset.toggleAdmin);if(!row)return;
  const enable=row.is_active===false;
  if(!confirm((enable?'เปิดสิทธิ์':'ระงับสิทธิ์')+' Admin รอง '+row.username+' ใช่หรือไม่?'))return;
  toggle.disabled=true;
  try{
    await adminOperation({action:'set_status',user_id:row.user_id,is_active:enable});
    setError('#accountActionMessage','เปลี่ยนสถานะบัญชี '+row.username+' เรียบร้อย');await refreshSubAdmins();
  }catch(err){setError('#accountActionMessage','เปลี่ยนสถานะไม่สำเร็จ: '+(err.message||err));}
  finally{toggle.disabled=false;}
}
async function resetSubAdminPassword(e){
  e.preventDefault();if(!activeResetUser)return;
  const password=$('#resetAccountPassword').value;
  try{
    checkStrongPassword(password);
    if(password!==$('#resetAccountConfirm').value)throw new Error('ยืนยันรหัสผ่านไม่ตรงกัน');
    if(!confirm('ยืนยันเปลี่ยนรหัสผ่านของบัญชีนี้หรือไม่?'))return;
    $('#saveResetPassword').disabled=true;
    await adminOperation({action:'reset_password',user_id:activeResetUser,password});
    $('#resetPasswordDialog').close();$('#resetPasswordForm').reset();activeResetUser=null;
    setError('#accountActionMessage','เปลี่ยนรหัสผ่านเรียบร้อย โปรดส่งรหัสใหม่อย่างปลอดภัย');
  }catch(err){setError('#resetPasswordError','เปลี่ยนรหัสผ่านไม่สำเร็จ: '+(err.message||err));}
  finally{$('#resetAccountPassword').value='';$('#resetAccountConfirm').value='';$('#saveResetPassword').disabled=false;}
}

document.addEventListener('DOMContentLoaded',initAdmin);
