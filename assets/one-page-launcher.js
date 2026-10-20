/* OTOP v2.7 non-invasive Admin enhancement: works for both master and sub admin. */
(()=>{'use strict';
  const rows=document.getElementById('adminProductRows');
  const toolbar=document.querySelector('.dash-buttons');
  if(!rows||!toolbar)return;
  const reportUrl=id=>'report.html'+(id?'?id='+encodeURIComponent(id):'');
  // Global report selector; hidden until Admin's authenticated dashboard is visible.
  if(!document.getElementById('openOnePageReport')){
    const button=document.createElement('button');button.type='button';button.id='openOnePageReport';
    button.className='admin-secondary';button.textContent='📄 One Page รายงานสินค้า';
    button.addEventListener('click',()=>{window.location.href=reportUrl('');});
    toolbar.appendChild(button);
  }
  const addButtons=()=>{
    for(const tr of rows.querySelectorAll('tr')){
      if(tr.querySelector('[data-onepage]'))continue;
      const edit=tr.querySelector('[data-edit]');
      if(!edit || !/^\d+$/.test(edit.dataset.edit))continue;
      const target=edit.parentElement;if(!target)continue;
      const button=document.createElement('button');
      button.type='button';button.className='edit-btn';button.setAttribute('data-onepage',edit.dataset.edit);
      button.textContent='One Page';button.title='สร้างรายงาน A4 สำหรับสินค้านี้';
      button.style.cssText='border-color:#b5c9bd;background:#e9f4ec;color:#205642';
      target.appendChild(button);
    }
  };
  rows.addEventListener('click',event=>{
    const button=event.target.closest('[data-onepage]');
    if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();
    window.location.href=reportUrl(button.dataset.onepage);
  },true);
  new MutationObserver(addButtons).observe(rows,{childList:true});
  addButtons();
})();
