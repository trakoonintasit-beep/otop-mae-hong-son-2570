/* One-time migration: originals stay intact; update URLs only after each successful Drive upload. */
(function(){'use strict';
const $=x=>document.querySelector(x);
const status=(message,bad=false)=>{const el=$('#driveMigrationStatus');el.textContent=message;el.style.color=bad?'#a53031':'#235c46';};
function needs(url){
  if(typeof url!=='string')return false;
  return /^assets\/images\/[\w.-]+\.(?:webp|jpg|jpeg|png)$/i.test(url)||
    /^https:\/\/glzfxtwlqgnybvnbnrpz\.supabase\.co\/storage\/v1\/object\/public\/product-images\//.test(url);
}
async function run(){
  if(!window.OTOP?.configured)return status('ระบบยังไม่เชื่อม Supabase',true);
  if(!confirm('ยืนยันย้ายรูปภาพเดิมที่ใช้อยู่ไป Google Drive? การดำเนินการอาจใช้เวลาหลายนาที และจะไม่ลบไฟล์ต้นฉบับ'))return;
  const button=$('#driveMigrate');button.disabled=true;
  let moved=0,failed=0,skipped=0;
  const urls=new Map();const client=window.OTOP.client();
  const convert=async (src,kind)=>{
    if(urls.has(src))return urls.get(src);
    const result=await window.OTOP_DRIVE.importImage(src,kind);
    urls.set(src,result.image_url);moved++;return result.image_url;
  };
  try{
    const auth=await client.auth.getUser();if(!auth.data?.user)throw Error('กรุณาเข้าสู่ระบบใหม่');
    status('กำลังค้นหาภาพสินค้าเดิม...');
    const {data:products,error}=await client.from('products').select('id,image').order('id',{ascending:true}).limit(1000);
    if(error)throw error;
    if(products?.length===1000)status('มีสินค้าอย่างน้อย 1,000 รายการ เครื่องมือนี้จะย้าย 1,000 รายการแรกก่อน');
    for(const p of products||[]){
      if(!needs(p.image)){skipped++;continue;}
      try{
        const url=await convert(p.image,'products');
        const changed=await client.from('products').update({image:url}).eq('id',p.id).eq('image',p.image);
        if(changed.error)throw changed.error;
        status('กำลังย้ายรูปสินค้า '+moved+' ภาพ • ผิดพลาด '+failed+' รายการ');
      }catch(e){failed++;status('ข้ามสินค้าหมายเลข '+p.id+': '+(e.message||e),true);}
    }
    const {data:site,error:siteError}=await client.from('otop_site_settings').select('content,updated_at').eq('id',1).maybeSingle();
    if(siteError)throw siteError;
    const current=site?.content?.hero_image||'assets/images/hero-mae-hong-son.webp';
    if(needs(current)){
      try{
        const hero=await convert(current,'website');
        const newContent={...(site?.content||{}),hero_image:hero};
        const saved=await client.from('otop_site_settings').update({content:newContent,updated_by:auth.data.user.id,updated_at:new Date().toISOString()}).eq('id',1).eq('updated_at',site.updated_at).select('id').maybeSingle();
        if(saved.error||!saved.data)throw Error(saved.error?.message||'ข้อมูลหน้าปกเปลี่ยนไปก่อนแล้ว กรุณาลองใหม่');
      }catch(e){failed++;status('ย้ายภาพหน้าปกไม่ได้: '+(e.message||e),true);}
    }
    status('ย้ายสำเร็จ '+moved+' ภาพ • ข้าม '+skipped+' รายการ • ข้อผิดพลาด '+failed+' รายการ\nรูปเดิมยังอยู่ในที่เก่า ตรวจภาพใหม่บนเว็บไซต์ก่อนลบต้นฉบับ');
  }catch(e){status('ย้ายไม่สำเร็จ: '+(e.message||e),true);}
  finally{button.disabled=false;}
}
function init(){
  $('#driveCheck')?.addEventListener('click',async()=>{
    try{status('กำลังตรวจสอบ Google Drive...');await window.OTOP_DRIVE.test();status('เชื่อมต่อ Google Drive สำเร็จ');}
    catch(e){status('เชื่อมต่อไม่ได้: '+(e.message||e),true);}
  });
  $('#driveMigrate')?.addEventListener('click',run);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
