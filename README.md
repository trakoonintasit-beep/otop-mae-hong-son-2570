# OTOP Mae Hong Son Digital Catalog 2570 — พร้อมหน้าผู้ดูแลระบบ

แคตตาล็อกสินค้า OTOP จังหวัดแม่ฮ่องสอน แบบ Responsive พร้อมระบบค้นหา หมวดหมู่ แผนที่ Leaflet / OpenStreetMap รายละเอียดสินค้า และ **หน้า Admin สำหรับเพิ่ม แก้ไข ลบข้อมูล**

## เข้าใช้งาน

- เว็บไซต์ลูกค้า: `index.html`
- หลังบ้าน: `admin.html`
- ปุ่ม "เข้าสู่ระบบเจ้าหน้าที่" ที่หัวเว็บไซต์
- ข้อมูลตัวอย่างใน `data/products.json` จำนวน 12 รายการ **ไม่ใช่สินค้า ราคา เบอร์โทร หรือพิกัดจริง**

## โหมด A: ทดสอบในเครื่อง (ใช้งานทันที ไม่ต้องมีเซิร์ฟเวอร์ฐานข้อมูล)

เปิดจาก root ของโปรเจกต์ด้วยเว็บเซิร์ฟเวอร์ เช่น `python -m http.server 8080` แล้วเข้า `http://localhost:8080/admin.html`

1. หน้าแรกจะแจ้ง **โหมดสาธิตเฉพาะเบราว์เซอร์**
2. ตั้งรหัสผ่านทดลองอย่างน้อย 8 ตัวอักษรด้วยตัวเอง (ไม่มีรหัสเริ่มต้นฝังในโค้ด)
3. หลังเข้าสู่ระบบ เพิ่ม/แก้ไข/ลบสินค้า และเลือกรูปภาพหรือ URL ได้
4. กลับไปดูหน้า `index.html` ในเบราว์เซอร์เดียวกัน ระบบจะแสดงสินค้าที่บันทึกไว้
5. การแก้ไขในโหมดนี้เก็บใน `localStorage` ของเบราว์เซอร์เท่านั้น **ไม่อัปเดตฐานข้อมูลหรือเว็บไซต์ของผู้อื่น**

> **คำเตือนความปลอดภัย:** รหัสผ่านทดลองนี้เป็นเพียงตัวล็อกหน้าจอในเครื่อง ไม่ใช่ระบบยืนยันตัวตนฝั่งเซิร์ฟเวอร์ การแก้ไขข้อมูล localStorage สามารถทำผ่าน Developer Tools ได้โดยไม่ต้องใช้รหัสผ่าน อย่าเข้าใจว่าปลอดภัยสำหรับเก็บข้อมูลจริง หรือใช้ตัวล็อกนี้เป็นการคุมสิทธิ์บน GitHub Pages แบบสาธารณะ

## โหมด B: ออนไลน์ ปลอดภัยด้วย Supabase Auth + Postgres RLS

GitHub Pages เป็น static hosting จึงไม่มีฐานข้อมูลที่เขียนจากเบราว์เซอร์และไม่มีระบบรหัสผ่านฝั่งเซิร์ฟเวอร์ให้เอง ต้องใช้บริการ Backend เพิ่มเติม เช่น Supabase เพื่อให้ข้อมูลสินค้าที่ Admin แก้ไขแสดงต่อผู้เข้าชมทุกคน

1. สมัคร Supabase และสร้าง Project ภายใต้บัญชีหน่วยงานที่มีการกำหนดผู้รับผิดชอบ
2. ใน Supabase → `SQL Editor` รันไฟล์ `supabase/setup.sql` เพื่อสร้าง `public.products`, `public.admins`, Storage bucket `product-images` และ Row Level Security
3. Supabase → `Authentication → Users` สร้างผู้ใช้ (อีเมล/รหัสผ่าน) สำหรับเจ้าหน้าที่ที่ได้รับมอบหมาย ใช้รหัสผ่านที่แข็งแรง ห้ามส่งรหัสผ่านผ่านแชต
4. ที่ SQL Editor รันคำสั่งนี้โดยแทน `YOUR_ADMIN_EMAIL@example.com` เป็นอีเมลผู้ดูแลที่สร้างแล้ว:
   ```sql
   INSERT INTO public.admins(user_id)
   SELECT id FROM auth.users WHERE email = 'YOUR_ADMIN_EMAIL@example.com'
   ON CONFLICT (user_id) DO NOTHING;
   ```
5. เข้า `Project Settings → API` คัดลอก **Project URL** และ **anon / publishable key** ไปใส่ใน `assets/config.js`:
   ```js
   window.OTOP_CONFIG = {
     supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
     supabaseAnonKey: 'YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY'
   };
   ```
   ตัว **anon/publishable key** เปิดเผยได้และทำงานร่วมกับ RLS; **ห้ามนำ service_role หรือ secret key** ไปไว้ใน source code, หน้าเว็บ หรือ GitHub โดยเด็ดขาด
6. ตั้งค่า Supabase Authentication ให้รองรับโดเมนเว็บไซต์ที่ใช้งาน (Site URL / Redirect URLs เมื่อมี OAuth หรืออีเมลลิงก์) และจัดการความปลอดภัยของบัญชีเจ้าหน้าที่อย่างเหมาะสม
7. เปิด `admin.html` → ใส่อีเมลและรหัสผ่านเจ้าหน้าที่ → เพิ่ม/แก้ไข/ลบสินค้า ระบบจะบันทึกลงฐานข้อมูลจริง ข้อมูลที่เปิด `เผยแพร่บนเว็บไซต์` จะแสดงที่ `index.html` สำหรับผู้ชมทุกคน

**สำคัญ:** เมื่อเปิด Supabase จะใช้ข้อมูลจากฐานข้อมูลออนไลน์เท่านั้น ไม่ดึงสินค้า 12 รายการจาก JSON มาเผยแพร่อัตโนมัติ เพื่อป้องกันข้อมูลสาธิตปะปนกับข้อมูลจริง เริ่มเพิ่มรายการผ่านหน้า Admin โดยตรวจสอบข้อมูลและการอนุญาตก่อนทุกครั้ง

### นโยบายสิทธิ์

- ผู้ชมทั่วไปอ่านได้เฉพาะแถว `is_published=true`
- บัญชีที่อยู่ใน `public.admins` เท่านั้นอ่านทุกแถว เพิ่ม แก้ไข และลบได้
- ข้อมูลรหัสผ่านใช้ Supabase Authentication ไม่เก็บรหัสผ่านใน GitHub, JavaScript หรือ `products`
- อัปโหลดรูปภาพเข้าบัคเก็ต public เฉพาะผู้ดูแลระบบ ด้วย Policy ของ Supabase Storage
- ต้องปฏิบัติตาม PDPA; ก่อนเผยแพร่เบอร์โทร/พิกัดร้านค้า ควรได้รับอนุญาตผู้ประกอบการ

### เกี่ยวกับข้อมูลทดลองและการย้ายข้อมูล

ข้อมูลสาธิตถูกแก้ไขแค่บนเครื่องผู้ใช้ ไม่ sync ไป Cloud โดยอัตโนมัติ หากต้องการนำข้อมูลจริงขึ้นระบบ ให้เพิ่มผ่านหลังบ้านหลังเชื่อม Supabase หรือนำข้อมูลที่ตรวจสอบแล้ว import เข้าฐานข้อมูลแบบมีผู้ดูแล

## Deploy บน GitHub Pages

1. สร้าง repo เช่น `otop-mae-hong-son-2570` แล้วอัปโหลด **เนื้อหาทั้งหมดของโฟลเดอร์โปรเจกต์** ไปยัง root ของ repo
2. GitHub → `Settings → Pages` → `Source: GitHub Actions`
3. เมื่อ push เข้า `main` workflow ใน `.github/workflows/pages.yml` จะ deploy เว็บไซต์
4. เว็บไซต์ `https://USERNAME.github.io/otop-mae-hong-son-2570/`
5. หลังปรับ `assets/config.js` ตาม Supabase ของหน่วยงาน ให้ commit/push ใหม่เพื่อเปิดใช้โหมดออนไลน์

**สถานะ:** ไฟล์ใน ZIP นี้เป็น source สำหรับ deploy ยังไม่ได้ push ไป GitHub หรือเชื่อม Supabase ให้โดยอัตโนมัติ

## โครงสร้างหลัก

```
index.html                  เว็บไซต์ผู้ซื้อ
admin.html                  หน้าล็อกอินและแดชบอร์ดผู้ดูแล
assets/app.js               ค้นหา กรองสินค้า แผนที่และรายละเอียด
assets/admin.js             Login และ CRUD
assets/admin.css            ดีไซน์หลังบ้าน
assets/shared.js            การเชื่อมต่อข้อมูล และยูทิลิตีร่วม
assets/config.js            การตั้งค่า Supabase (ไม่มี secret key)
data/products.json          ข้อมูลสาธิต
supabase/setup.sql          SQL + RLS + bucket
.github/workflows/pages.yml deploy GitHub Pages
```
