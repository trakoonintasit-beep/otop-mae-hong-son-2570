/* Frontend website editor. Database RLS is the authorization boundary. */
(function(){
'use strict';
let inited=false,loaded=false,original=null,updatedAt=null,changed=false,localImage=null,localImageUrl=null,saving=false;
const $=s=>document.querySelector(s), site=()=>window.OTOP_SITE;
const status=(text,err=false)=>{const e=$('#siteSaveStatus');e.textContent=text||'';e.style.color=err?'#a53031':'#206b4b';};
function fields(){return [...document.querySelectorAll('#siteSettingsForm [data-setting]')];}
function updateOutputs(){fields().filter(e=>e.type==='range').forEach(e=>{
 const target=document.querySelector('[data-output="'+e.dataset.setting+'"]');
 if(target)target.value=e.value+ (['hero_title_size','hero_height'].includes(e.dataset.setting)?' px':e.dataset.setting==='hero_overlay_opacity'||e.dataset.setting==='hero_image_position'?' %':'');
});}
function fill(values){const content=site().normalize(values);fields().forEach(e=>{if(Object.hasOwn(content,e.dataset.setting))e.value=content[e.dataset.setting];});updateOutputs();}
function read(){const content={};fields().forEach(el=>{content[el.dataset.setting]=el.value;});return site().normalize(content);}
function preview(){
 const frame=$('#sitePreviewFrame');const origin=location.origin;
 if(!frame?.contentWindow)return;
 frame.contentWindow.postMessage({type:'OTOP_SITE_PREVIEW',content:read(),previewHeroUrl:localImageUrl||''},origin);
}
function imageReset(){if(localImageUrl)URL.revokeObjectURL(localImageUrl);localImageUrl=null;localImage=null;$('#siteHeroUpload').value='';}
function setLocalFile(file){imageReset();if(!file)return;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('รองรับภาพ JPEG, PNG หรือ WebP เท่านั้น');
 if(file.size>15*1024*1024)throw Error('ภาพต้นฉบับต้องมีขนาดไม่เกิน 15 MB (ระบบจะย่อขนาดก่อนอัปโหลด)');
 localImage=file;localImageUrl=URL.createObjectURL(file);
}
async function loadPublished(){
 status('กำลังโหลดข้อความที่เผยแพร่...');
 if(!window.OTOP?.configured){status('โหมดทดลอง: ต้องตั้ง Supabase ก่อนใช้งานจริง',true);return;}
 try{
  const {data,error}=await window.OTOP.client().from('otop_site_settings').select('content,updated_at').eq('id',1).maybeSingle();
  if(error)throw error;
  if(!data)throw Error('ยังไม่มีแถวตั้งค่าเว็บไซต์ id=1 กรุณารัน SQL migration ก่อน');
  original=site().normalize(data.content||{});updatedAt=data.updated_at;
  imageReset();fill(original);changed=false;loaded=true;preview();
  $('#siteEditorNotice').hidden=true;status('โหลดค่าที่เผยแพร่ล่าสุดแล้ว · ปรับแต่งในแบบฟอร์มและกดบันทึกเมื่อพร้อม');
 }catch(e){loaded=false;$('#siteEditorNotice').hidden=false;$('#siteEditorNotice').textContent='อ่านค่าจาก Supabase ไม่สำเร็จ: '+(e.message||e)+' — ติดตั้ง supabase/migrations/20261020_site_editor.sql ก่อน';status('ดูตัวอย่างด้วยค่าเริ่มต้นได้ แต่ยังบันทึกออนไลน์ไม่ได้',true);fill(site().defaults);preview();}
}
async function publish(event){
 event.preventDefault();if(saving)return;
 if(!loaded)return status('ยังไม่สามารถอ่านฐานข้อมูลตั้งค่าเว็บไซต์ กรุณาติดตั้ง SQL ก่อน',true);
 if(!window.OTOP?.configured)return status('ต้องเชื่อม Supabase เพื่อบันทึกเว็บไซต์',true);
 if(!confirm('ยืนยันบันทึกและเผยแพร่ข้อความ/ภาพหน้าปกสำหรับผู้เข้าชมทุกคน?'))return;
 saving=true;$('#sitePublishButton').disabled=true;status('กำลังบันทึกการเปลี่ยนแปลง...');
 try{
  const client=window.OTOP.client();const {data:auth,error:authErr}=await client.auth.getUser();
  if(authErr||!auth?.user)throw Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
  const content=read();
  if(localImage){
   if(!window.OTOP_DRIVE)throw Error('ยังไม่ได้โหลดระบบ Google Drive');
   status('กำลังบีบอัดและอัปโหลดภาพหน้าปกไป Google Drive...');
   const uploaded=await window.OTOP_DRIVE.upload(localImage,'website');
   content.hero_image=uploaded.image_url;
  }
  const saved=await client.from('otop_site_settings')
   .update({content,updated_by:auth.user.id,updated_at:new Date().toISOString()})
   .eq('id',1).eq('updated_at',updatedAt).select('updated_at').maybeSingle();
  if(saved.error)throw saved.error;
  if(!saved.data)throw Error('ข้อมูลถูกแก้ไขจากบัญชีอื่น กรุณากด "โหลดค่าที่เผยแพร่ใหม่" ก่อน');
  updatedAt=saved.data.updated_at;original=site().normalize(content);fill(original);
  imageReset();loaded=true;changed=false;preview();
  status('บันทึกสำเร็จ! หน้าเว็บไซต์สาธารณะจะแสดงค่าที่แก้ไขเมื่อรีเฟรช ไม่ต้องแก้ GitHub');
 }catch(e){status('บันทึกไม่สำเร็จ: '+(e.message||e),true);}
 finally{saving=false;$('#sitePublishButton').disabled=false;}
}
async function activate(){
 if(!inited)return;
 if(!loaded)await loadPublished();
 else preview();
}
function init(){
 const form=$('#siteSettingsForm');if(!form||!site())return;
 inited=true;fill(site().defaults);
 form.addEventListener('submit',publish);
 form.addEventListener('input',event=>{
  if(event.target.id==='siteHeroUpload')return;
  if(event.target.id==='siteHeroUrl' && localImage)imageReset();
  changed=true;updateOutputs();preview();status('ยังไม่เผยแพร่ · ตรวจสอบผลในหน้าตัวอย่างก่อนบันทึก');
 });
 form.addEventListener('change',()=>{changed=true;preview();});
 $('#siteHeroUpload').addEventListener('change',e=>{
  try{setLocalFile(e.target.files[0]);if(localImage){changed=true;status('เลือกภาพหน้าปกใหม่แล้ว (ยังไม่อัปโหลดจนกดบันทึก)');preview();}}
  catch(err){status(err.message,true);imageReset();}
 });
 $('#siteRestoreDefaults').addEventListener('click',()=>{
  if(!confirm('คืนค่าเริ่มต้นในตัวอย่าง? (ยังไม่บันทึกลงเว็บไซต์)'))return;
  imageReset();fill(site().defaults);changed=true;preview();status('ใช้ข้อความต้นแบบในตัวอย่างแล้ว กรุณากดเผยแพร่หากต้องการบันทึก');
 });
 $('#siteReloadPublished').addEventListener('click',()=>{if(changed&&!confirm('ทิ้งการแก้ไขที่ยังไม่ได้บันทึกและโหลดค่าที่เผยแพร่?'))return;loadPublished();});
 $('#sitePreviewFrame').addEventListener('load',preview);
 document.querySelectorAll('[data-preview-width]').forEach(btn=>btn.addEventListener('click',()=>{
  const mobile=btn.dataset.previewWidth==='mobile';
  $('.site-preview-wrap').classList.toggle('site-preview-mobile',mobile);
  document.querySelectorAll('[data-preview-width]').forEach(x=>x.classList.toggle('is-selected',x===btn));
 }));
 // On initial restore of a signed-in master session, admin.js will call activate().
}
window.OTOP_SITE_ADMIN={activate};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
