(function () {
  'use strict';
  const CONFIG = window.OTOP_CONFIG || {};
  const STORAGE_KEY = 'otop_mhs_2570_demo_products_v2';
  const DEMO_PW_KEY = 'otop_mhs_2570_demo_auth_v2';
  const DISTRICTS = ['เมืองแม่ฮ่องสอน', 'ปาย', 'ปางมะผ้า', 'ขุนยวม', 'แม่ลาน้อย', 'แม่สะเรียง', 'สบเมย'];
  const CATEGORIES = ['อาหาร', 'เครื่องดื่ม', 'ผ้าและเครื่องแต่งกาย', 'ของใช้', 'ของที่ระลึก', 'สมุนไพร'];
  const configured = !!(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
  let supabaseClient = null;
  function client() {
    if (!configured) return null;
    if (!window.supabase || !window.supabase.createClient) throw new Error('ไม่สามารถโหลด Supabase SDK ได้');
    if (!supabaseClient) supabaseClient = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
    return supabaseClient;
  }
  async function sourceProducts() {
    if (configured) {
      const { data, error } = await client().from('products').select('*').eq('is_published', true).order('id', {ascending: true});
      if (error) throw error;
      return data || [];
    }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { const parsed = JSON.parse(saved); if (Array.isArray(parsed)) return parsed.filter(row => row.is_published !== false); } catch {}
    }
    const res = await fetch('data/products.json');
    if (!res.ok) throw new Error('อ่านข้อมูลสาธิตไม่สำเร็จ กรุณาเปิดผ่าน Web Server');
    return res.json();
  }
  async function allDemoProducts() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { const parsed = JSON.parse(saved); if (Array.isArray(parsed)) return parsed; } catch {}
    }
    const res = await fetch('data/products.json');
    if (!res.ok) throw new Error('ไม่สามารถโหลดรายการตัวอย่าง');
    return res.json();
  }
  function saveDemoProducts(rows) { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)); }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
  function imgUrl(value) {
    const v = String(value ?? '').trim();
    if (/^https:\/\//i.test(v) || /^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/=]+$/i.test(v)) return v;
    if (/^assets\/images\/[a-z0-9_.-]+\.(png|jpg|jpeg|webp)$/i.test(v)) return v;
    return 'assets/images/hero-mae-hong-son.png';
  }
  function externalUrl(value) { const v=String(value||'').trim(); if (/^https:\/\//i.test(v)) return v; return ''; }
  function whatsappPhone(value) { return String(value||'').replace(/[^+0-9]/g, ''); }
  function gmap(lat, lng) {
    if (lat === null || lat === undefined || lat === '' || lng === null || lng === undefined || lng === '') return '';
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return '';
    if (Number(lat)<-90||Number(lat)>90||Number(lng)<-180||Number(lng)>180) return '';
    return `https://www.google.com/maps/dir/?api=1&destination=${Number(lat)},${Number(lng)}`;
  }
  async function hashPassword(password,salt) {
    if (!crypto.subtle) throw new Error('ต้องเปิดผ่าน HTTPS หรือ localhost');
    const bytes = new TextEncoder().encode(password);
    const key = await crypto.subtle.importKey('raw',bytes,'PBKDF2',false,['deriveBits']);
    const saltBytes=Uint8Array.from(salt.match(/.{1,2}/g).map(x=>parseInt(x,16)));
    const raw = await crypto.subtle.deriveBits({name:'PBKDF2',salt:saltBytes,iterations:160000,hash:'SHA-256'}, key, 256);
    return Array.from(new Uint8Array(raw)).map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  const money = value => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(Number(value) || 0);
  window.OTOP = {CONFIG, STORAGE_KEY, DEMO_PW_KEY, DISTRICTS, CATEGORIES, configured, client, sourceProducts, allDemoProducts, saveDemoProducts, esc, imgUrl, externalUrl, whatsappPhone, gmap, hashPassword, money};
})();
