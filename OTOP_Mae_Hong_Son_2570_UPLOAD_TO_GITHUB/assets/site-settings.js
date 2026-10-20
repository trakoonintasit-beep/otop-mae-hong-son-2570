/* OTOP Mae Hong Son: public editable website content. No credentials here. */
(function () {
  'use strict';
  let previewActive=false;
  const defaults = Object.freeze({
    brand_subtitle: 'DIGITAL CATALOG 2570',
    nav_catalog: 'สินค้า', nav_stories: 'เรื่องราว', nav_map: 'แผนที่ร้านค้า', nav_about: 'เกี่ยวกับ',
    hero_eyebrow: 'OTOP MAE HONG SON · 2570',
    hero_title_top: 'ค้นหา • ช้อป • เที่ยว', hero_title_bottom: 'ถึงที่ในหน้าเดียว',
    hero_description: 'ต้นแบบแคตตาล็อกดิจิทัลที่เชื่อมสินค้า ผู้ประกอบการ เรื่องราวชุมชน และพิกัดร้านค้าไว้ในประสบการณ์เดียว',
    hero_button_primary: 'สำรวจสินค้า', hero_button_secondary: 'ดูแผนที่ร้านค้า',
    hero_image: 'assets/images/hero-mae-hong-son.webp', hero_image_alt: 'ภาพประกอบภูเขาและหมอกแม่ฮ่องสอน',
    hero_align: 'left', hero_vertical: 'bottom', hero_title_size: 94, hero_line_height: 1.0,
    hero_image_position: 50, hero_overlay_opacity: 75, hero_height: 640,
    hero_text_color: '#ffffff', hero_accent_color: '#f7d997',
    catalog_eyebrow: 'THE LOCAL COLLECTION', catalog_title: 'ของดีที่อยากให้คุณค้นพบ',
    catalog_description: 'ค้นหาจากชื่อสินค้า กลุ่มผู้ผลิต คำสำคัญ หรือพื้นที่',
    story_eyebrow: 'BEHIND THE CRAFT', story_title: 'มากกว่าสินค้า คือเรื่องราวชุมชน',
    story_description: 'แต่ละชิ้นงานสามารถพาผู้ใช้งานไปรู้จักภูมิปัญญา ผู้คน และพื้นที่ที่อยู่เบื้องหลังสินค้าได้',
    story_1_title: 'เรื่องราวที่สร้างมูลค่า',
    story_1_text: 'บอกที่มา วัตถุดิบ กระบวนการ และความหมายของผลิตภัณฑ์ด้วยข้อมูลที่ผู้ประกอบการยืนยัน',
    story_2_title: 'ค้นพบตามพื้นที่',
    story_2_text: 'เลือกสินค้าแล้วเชื่อมต่อไปยังอำเภอ ร้านค้า และแหล่งท่องเที่ยวใกล้เคียงได้ในอนาคต',
    story_3_title: 'QR สู่ข้อมูลเดียวกัน',
    story_3_text: 'นำลิงก์สินค้าไปสร้าง QR สำหรับบรรจุภัณฑ์ ป้ายร้าน งาน OTOP และสื่อประชาสัมพันธ์ได้',
    map_eyebrow: 'FIND YOUR NEXT STOP', map_title: 'จากหน้าจอ สู่หน้าร้าน',
    about_eyebrow: 'LOCAL HEART, DIGITAL CONNECTION', about_title: 'ของดีแม่ฮ่องสอน\nค้นพบง่ายขึ้น เชื่อมต่อได้จริง',
    about_description: 'แนวคิดนี้มุ่งให้เว็บไซต์เป็นศูนย์กลางข้อมูลระดับจังหวัด ไม่ใช่ Marketplace เต็มรูปแบบในระยะเริ่มต้น ผู้ใช้งานสามารถค้นหา ดูรายละเอียด ติดต่อผู้ขายเมื่อมีข้อมูลจริง และเปิดเส้นทางไปยังร้านค้าได้ โดยทุกข้อมูลควรผ่านการตรวจสอบก่อนเผยแพร่ และต้องได้รับอนุญาตให้เผยแพร่ข้อมูลติดต่อหรือพิกัดร้านค้า',
    footer_agency: 'สำนักงานพัฒนาชุมชนจังหวัดแม่ฮ่องสอน',
    footer_description: 'OTOP Mae Hong Son Digital Catalog 2570 · เว็บไซต์ OTOP',
    footer_slogan: 'ฮ่องสอน ฮอมฮัก Drive to Done',
    footer_bg_color: '#102b24', footer_text_color: '#ffffff'
  });
  const numerical = {
    hero_title_size: [42, 106], hero_line_height: [0.9, 1.5],
    hero_image_position: [0, 100], hero_overlay_opacity: [35, 95], hero_height: [460, 800]
  };
  const enumerated = {hero_align: ['left','center','right'],hero_vertical: ['top','center','bottom']};
  const colors = new Set(['hero_text_color','hero_accent_color','footer_bg_color','footer_text_color']);
  const isImage = url => /^(?:https:\/\/[^\s"<>]+|assets\/images\/[\w.\-]+\.(?:webp|jpg|jpeg|png))$/i.test(url);
  function normalize(input) {
    const result = {...defaults};
    if (!input || typeof input !== 'object' || Array.isArray(input)) return result;
    for (const key of Object.keys(defaults)) {
      const value = input[key]; if(value === undefined || value === null) continue;
      if(Object.hasOwn(numerical,key)){
        const v=Number(value), [min,max]=numerical[key];
        if(Number.isFinite(v)) result[key]=Math.min(max,Math.max(min,v));
      }else if(Object.hasOwn(enumerated,key)){
        if(enumerated[key].includes(value)) result[key]=value;
      }else if(colors.has(key)){
        if(typeof value==='string' && /^#[0-9a-f]{6}$/i.test(value)) result[key]=value;
      }else if(key==='hero_image'){
        if(typeof value==='string' && isImage(value))result[key]=value;
      }else if(typeof value==='string'){
        result[key]=value.slice(0,key.endsWith('_description')||key.endsWith('_text')?950:220);
      }
    }
    return result;
  }
  function apply(input, root=document){
    const d=normalize(input);
    root.querySelectorAll('[data-site-text]').forEach(el=>{
      const key=el.getAttribute('data-site-text');
      if(Object.hasOwn(d,key))el.textContent=d[key];
    });
    const hero=root.querySelector('#home');
    if(hero){
      hero.dataset.siteAlign=d.hero_align;hero.dataset.siteVertical=d.hero_vertical;
      hero.style.setProperty('--otop-hero-size', d.hero_title_size+'px');
      hero.style.setProperty('--otop-hero-line',String(d.hero_line_height));
      hero.style.setProperty('--otop-hero-height',d.hero_height+'px');
      hero.style.setProperty('--otop-hero-text',d.hero_text_color);
      hero.style.setProperty('--otop-hero-accent',d.hero_accent_color);
      hero.style.setProperty('--otop-hero-overlay',String(d.hero_overlay_opacity/100));
      const img=hero.querySelector('.hero-bg');
      if(img){img.src=d.hero_image;img.alt=d.hero_image_alt;img.style.objectPosition='center '+d.hero_image_position+'%';}
    }
    const footer=root.querySelector('footer');
    if(footer){footer.style.setProperty('--otop-footer-bg',d.footer_bg_color);footer.style.setProperty('--otop-footer-text',d.footer_text_color);}
    return d;
  }
  async function load(){
    if(!document.getElementById('home'))return;
    if(!(window.OTOP?.configured))return;
    try{
      const {data,error}=await window.OTOP.client().from('otop_site_settings').select('content').eq('id',1).maybeSingle();
      if(error){console.warn('OTOP site settings not available yet',error.code);return;}
      if(data?.content&&!previewActive)apply(data.content);
    }catch(e){console.warn('OTOP site settings unavailable',e?.message||e);}
  }
  window.OTOP_SITE={defaults,normalize,apply,load};
  window.addEventListener('message',e=>{
    if(e.origin!==location.origin || e.source!==window.parent || !e.data || e.data.type!=='OTOP_SITE_PREVIEW')return;
    if(!document.getElementById('home'))return;
    previewActive=true;
    apply(e.data.content);
    if(typeof e.data.previewHeroUrl==='string' && e.data.previewHeroUrl.startsWith('blob:'+location.origin+'/')){
      const heroImg=document.querySelector('#home .hero-bg'); if(heroImg)heroImg.src=e.data.previewHeroUrl;
    }
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);
  else load();
})();
