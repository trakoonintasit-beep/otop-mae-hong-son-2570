/* v2.9 enhancement: premium gallery. Database fields are added by v2.9 SQL migration. */
(()=>{'use strict';const $=id=>document.getElementById(id);const p=$('reportSheet');if(!p)return;
const gallery=document.createElement('div');gallery.className='premium-gallery';const photo=p.querySelector('.sheet-photo');if(!photo)return;photo.appendChild(gallery);
const inputs=document.querySelectorAll('[data-extra="secondary_image_1"],[data-extra="secondary_image_2"]');
function refresh(){gallery.replaceChildren();for(const el of inputs){const val=el.value.trim();if(!/^https:\/\//i.test(val))continue;const img=document.createElement('img');img.src=val;img.crossOrigin='anonymous';img.alt='ภาพรายละเอียดสินค้าประกอบ';img.loading='eager';gallery.appendChild(img);}}
inputs.forEach(el=>{el.addEventListener('input',refresh);el.addEventListener('change',refresh);});
const observer=new MutationObserver(()=>refresh());const product=$('productStatus');if(product)observer.observe(product,{childList:true});
refresh();
})();
document.addEventListener('DOMContentLoaded',()=>{
 const btn=document.getElementById('premiumUploadButton');if(!btn)return;
 btn.addEventListener('click',async()=>{const file=document.getElementById('premiumUpload')?.files[0];if(!file){alert('กรุณาเลือกรูปภาพก่อน');return;}
  btn.disabled=true;btn.textContent='กำลังอัปโหลด Google Drive…';try{
   const a=await window.OTOP_DRIVE.upload(file,'products');const fields=[...document.querySelectorAll('[data-extra="secondary_image_1"],[data-extra="secondary_image_2"]')];const dest=fields.find(x=>!x.value.trim())||fields[1];
   dest.value=a.image_url;dest.dispatchEvent(new Event('input',{bubbles:true}));alert('อัปโหลดสำเร็จ กรุณากดบันทึกข้อมูล One Page เพื่อเก็บลิงก์ภาพ');
  }catch(e){alert('อัปโหลดไม่สำเร็จ: '+(e.message||e));}finally{btn.disabled=false;btn.textContent='อัปโหลดภาพแล้วใส่ในช่องที่ว่าง';}
 });
});
