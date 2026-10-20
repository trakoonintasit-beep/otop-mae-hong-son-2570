/* OTOP Drive media client: Supabase Auth session; never store Google credentials here. */
(function(){'use strict';
const LIMIT=5*1024*1024;
const TYPES=['image/jpeg','image/png','image/webp'];
const client=()=>window.OTOP.client();
async function invoke(body){
  if(!window.OTOP?.configured)throw Error('ต้องเชื่อมต่อ Supabase ก่อนใช้งาน Google Drive');
  const s=await client().auth.getSession();
  if(!s.data?.session?.access_token)throw Error('กรุณาเข้าสู่ระบบ Admin ใหม่');
  const result=await client().functions.invoke('otop-drive-upload',{body});
  if(result.error){
    let detail='';let status=result.error.context?.status||0;
    try{detail=(await result.error.context?.clone?.().json())?.error||'';}catch{}
    throw Error(detail|| (status===404?'ไม่พบ Edge Function otop-drive-upload กรุณา Deploy':'เชื่อม Google Drive ไม่สำเร็จ ('+(status||'Network/CORS')+') ตรวจ Deploy, Secrets และ Logs'));
  }
  if(!result.data?.ok)throw Error(result.data?.error||'ระบบไม่ได้ยืนยันการอัปโหลด');
  return result.data;
}
const blob64=blob=>new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onerror=()=>reject(Error('อ่านไฟล์ภาพไม่ได้'));
  reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(blob);
});
async function prepare(file,kind){
  if(!file||!TYPES.includes(file.type))throw Error('รองรับ JPG, PNG และ WebP เท่านั้น');
  if(file.size>15*1024*1024)throw Error('ภาพต้นฉบับต้องไม่เกิน 15 MB');
  const max=kind==='website'?2200:1800;
  try{
    const bitmap=await createImageBitmap(file);
    const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    bitmap.close?.();
    const compressed=await new Promise(ok=>canvas.toBlob(ok,'image/webp',.82));
    if(compressed?.size>0&&compressed.size<=LIMIT)return compressed;
  }catch{}
  if(file.size>LIMIT)throw Error('ไฟล์ยังเกิน 5 MB หลังปรับขนาด กรุณาลดขนาดภาพก่อนอัปโหลด');
  return file;
}
async function upload(file,kind){
  if(!['products','website'].includes(kind))throw Error('ชนิดภาพไม่ถูกต้อง');
  const prepared=await prepare(file,kind);
  return invoke({action:'upload',kind,mime:prepared.type,base64:await blob64(prepared)});
}
async function importImage(url,kind){return invoke({action:'import',kind,source_url:url});}
async function test(){return invoke({action:'ping',kind:'products'});}
window.OTOP_DRIVE={upload,importImage,test};
})();
