(()=>{'use strict';const O=window.OTOP,$=id=>document.getElementById(id),districts=O.DISTRICTS;const esc=O.esc;
const status=(s,err=false)=>{$('status').textContent=s;$('status').classList.toggle('error',err);};
async function start(){try{
 if(!O.configured)throw Error('ต้องติดตั้งเว็บไซต์ออนไลน์ผ่าน Supabase');
 const {data:{user},error}=await O.client().auth.getUser();if(error||!user)throw Error('กรุณาเข้าสู่ระบบ Admin ก่อน');
 const r=await O.client().from('admins').select('role,district,is_active').eq('user_id',user.id).single();if(r.error||!r.data?.is_active)throw Error('บัญชีไม่มีสิทธิ์ใช้งาน');
 const isOfficer=r.data.role==='district_officer';const district=isOfficer?r.data.district:null;
 if(isOfficer&&(!district||!districts.includes(district)))throw Error('บัญชีนี้ยังไม่ได้รับการกำหนดอำเภอ');
 let products=[];for(let i=0;i<20000;i+=500){let q=O.client().from('products').select('id,name,district,category,price,producer,featured,is_published,updated_at');if(isOfficer)q=q.eq('district',district);const result=await q.order('id',{ascending:false}).range(i,i+499);if(result.error)throw result.error;products.push(...(result.data||[]));if(result.data?.length!==500)break;}
 const n=products.length,pub=products.filter(p=>p.is_published!==false).length,featured=products.filter(p=>p.featured).length;
 $('total').textContent=n.toLocaleString('th-TH');$('published').textContent=pub.toLocaleString('th-TH');$('featured').textContent=featured.toLocaleString('th-TH');$('producer').textContent=new Set(products.map(p=>p.producer?.trim()).filter(Boolean)).size.toLocaleString('th-TH');
 const counts=districts.map(d=>({d,n:products.filter(p=>p.district===d).length}));
 $('districts').innerHTML=counts.map(x=>`<article class="district-card"><strong>${esc(x.d)}</strong><b>${x.n.toLocaleString('th-TH')}</b><span class="tiny muted">ผลิตภัณฑ์</span></article>`).join('');
 const bars=(items,target)=>{let max=Math.max(1,...items.map(x=>x.n));$(target).innerHTML=items.map(x=>`<div class="bar-row"><span>${esc(x.d)}</span><div class="bar-bg"><div class="bar-fill" style="width:${x.n/max*100}%"></div></div><strong>${x.n}</strong></div>`).join('');};
 bars(counts,'districtBars');bars(O.CATEGORIES.map(d=>({d,n:products.filter(p=>O.canonicalCategory(p.category)===d).length})),'categories');
 $('recentRows').innerHTML=products.sort((a,b)=>new Date(b.updated_at||0)-new Date(a.updated_at||0)).slice(0,15).map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.district)}</td><td>${esc(p.category)}</td><td><span class="tag ${p.is_published?'':'pending'}">${p.is_published?'เผยแพร่':'ร่าง'}</span></td><td>${O.money(p.price)}</td></tr>`).join('')||'<tr><td colspan="5">ยังไม่มีข้อมูลสินค้า</td></tr>';
 $('dashboard').hidden=false;status(isOfficer?'ข้อมูลของอำเภอ'+district+' ตามสิทธิ์เจ้าหน้าที่':'ข้อมูลระดับจังหวัดครบ 7 อำเภอ · อัปเดตจาก Supabase');
 }catch(e){status('เปิด Dashboard ไม่สำเร็จ: '+(e.message||e),true);}}
 let dashboardRefreshing=false;let dashboardLastRefresh=0;
 async function safeRefresh(){
  if(dashboardRefreshing||document.hidden)return;
  dashboardRefreshing=true;
  try{await start();if(!$('status').classList.contains('error')){dashboardLastRefresh=Date.now();$('status').textContent+=' · รีเฟรช '+new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})+' น.';}}
  finally{dashboardRefreshing=false;}
 }
 document.addEventListener('DOMContentLoaded',()=>{void safeRefresh();setInterval(()=>{void safeRefresh();},5*60*1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-dashboardLastRefresh>=5*60*1000)void safeRefresh();});});
})();
