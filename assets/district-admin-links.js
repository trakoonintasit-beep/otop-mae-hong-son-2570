/* v2.8: link standalone, authenticated admin workspaces without replacing existing menus. */
(()=>{'use strict';const toolbar=document.querySelector('.dash-buttons');if(!toolbar)return;
const links=[['dashboard.html','📊 Dashboard 7 อำเภอ'],['district.html','📍 เจ้าหน้าที่อำเภอ'],['review.html','✅ อนุมัติสินค้า']];
for(const [href,title] of links){if(toolbar.querySelector(`[data-href="${href}"]`))continue;const a=document.createElement('a');a.href=href;a.textContent=title;a.dataset.href=href;a.className='admin-secondary';a.style.cssText='display:inline-flex;text-decoration:none;align-items:center;justify-content:center;font-size:12px';toolbar.appendChild(a);}
})();
