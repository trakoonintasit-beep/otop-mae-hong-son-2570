# OTOP Mae Hong Son Digital Catalog v2.2

> เริ่มต้นอัปเดตได้จาก `CHANGELOG_v2_2.md` และ `UPDATE_GITHUB.txt` อย่าเขียนทับการเชื่อมต่อ Supabase ใน `assets/config.js` เดิม

# OTOP Mae Hong Son Digital Catalog 2570 — เวอร์ชันปรับปรุง v2.1

เว็บไซต์ One Page สำหรับสำนักงานพัฒนาชุมชนจังหวัดแม่ฮ่องสอน ภายใต้แนวคิด **“ค้นหา • ช้อป • เที่ยว • ถึงที่ในหน้าเดียว”** รองรับมือถือและคอมพิวเตอร์ พร้อมหน้า Admin เพิ่ม/แก้ไข/ลบสินค้า

> **สถานะของไฟล์นี้:** เป็นซอร์สโค้ดพร้อมอัปโหลด GitHub Pages และรองรับการเชื่อม Supabase แต่ยัง **ไม่ได้เชื่อมฐานข้อมูลออนไลน์จริง** และยัง **ไม่มีบัญชีผู้ดูแลออนไลน์** สินค้า 12 รายการและพิกัดเป็นข้อมูลทดลองเท่านั้น

## สิ่งที่เพิ่มใน v2.1

- ค้นหา/กรองหมวดสินค้าและ 7 อำเภอ พร้อมเรียงตามราคาและแสดงเพิ่มเติมเป็นชุด
- ลิงก์สินค้าแบบแยกรายการ (`#product-1`) แชร์ให้ผู้อื่นเปิดสินค้าชิ้นเดียวได้
- QR Code ต่อสินค้า: สร้างจากลิงก์ในเบราว์เซอร์ พร้อมบันทึก PNG หรือคัดลอกลิงก์ (ใช้ไลบรารี `qrcodejs` จาก CDN; หากโหลดไม่ได้จะมีปุ่มคัดลอกลิงก์สำรอง)
- ใส่ข้อความเตือนชัดเจนในโหมดสาธิต และ **ไม่แสดงปุ่มนำทาง Google Maps ภายนอกสำหรับพิกัดสาธิต**
- Admin มีปุ่มสำรองข้อมูลเป็น JSON และนำเข้าข้อมูลทดลองจาก JSON ได้เฉพาะเบราว์เซอร์
- เพิ่มสินค้าใหม่จะเริ่มเป็น **ฉบับร่าง** ผู้ดูแลต้องยืนยันสิทธิ์เผยแพร่ข้อมูลก่อนกดเผยแพร่
- รูปภาพตัวอย่างเปลี่ยนเป็น WebP ขนาดรวมลดจากประมาณ 17.3 MB เหลือ 1.3 MB
- `noindex` ขณะเป็นต้นแบบสาธิต เพื่อไม่ให้เครื่องมือค้นหานำข้อมูลตัวอย่างไปแสดงเป็นสินค้าจริง
- ปรับปรุงการแสดงผลบนมือถือ การเข้าถึงผ่านคีย์บอร์ด และรองรับโหมดลดการเคลื่อนไหว

## โครงสร้างไฟล์

```text
index.html                 แคตตาล็อกสินค้าและแผนที่
admin.html                 หน้า Login / Dashboard / Editor
assets/app.js              ค้นหา แสดงสินค้า แชร์ QR และแผนที่
assets/admin.js            Login CRUD และสำรองข้อมูล
assets/shared.js           โหลดสินค้า + Supabase Client + ฟังก์ชันร่วม
assets/config.js           ข้อมูลเชื่อมต่อ Supabase (เฉพาะ Project URL + publishable/anon key)
assets/style.css           CSS หน้าเว็บ
assets/admin.css           CSS หน้า Admin
assets/images/*.webp       รูปตัวอย่าง WebP
assets/favicon.svg         ไอคอน
supabase/setup.sql         สร้างตาราง, Row Level Security, Storage policy
data/products.json         สินค้าสาธิต 12 รายการ
deploy/pages.yml.example     ตัวอย่าง GitHub Actions (ไม่เปิดใช้โดยอัตโนมัติ)
```

## ทดลองในเครื่อง

จากโฟลเดอร์โปรเจกต์:

```bash
python -m http.server 8080
```

- หน้าเว็บ: http://localhost:8080/index.html
- Admin: http://localhost:8080/admin.html
- เริ่มต้นตั้งรหัสผ่านทดลองเอง 8 ตัวอักษรขึ้นไป (ไม่ฝังรหัสผ่านไว้ในซอร์ส)
- ข้อมูลทดลองเก็บใน `localStorage` เฉพาะเบราว์เซอร์ที่แก้ไข **ไม่ใช่ฐานข้อมูลที่เผยแพร่ทั่วโลก**

**ความปลอดภัย:** รหัสผ่านทดลองเป็นเพียงหน้ากั้น UI ในเบราว์เซอร์ และไม่ใช่ระบบ Auth ฝั่งเซิร์ฟเวอร์ ไม่เหมาะใช้จริงกับข้อมูลบุคคล ไม่ควรใส่ข้อมูลที่ไม่สามารถเปิดเผยได้ในโหมดทดลอง

## อัปเดตโปรเจกต์ GitHub ปัจจุบัน

Repository: https://github.com/trakoonintasit-beep/otop-mae-hong-son-2570

**สำคัญ:** ใช้ไฟล์ *ภายใน ZIP* วางที่ **root** ของ repository เดิม ไม่สร้างโฟลเดอร์ครอบใหม่อีก

วิธีง่ายผ่าน Codespaces:

1. ดาวน์โหลด ZIP ของเวอร์ชันนี้ แล้วอัปโหลดไฟล์ ZIP ไปไว้ที่โฟลเดอร์ root ของ Codespaces
2. เปิด **Terminal** และรันคำสั่งตามด้านล่าง โดยแทน `YOUR_ZIP_FILENAME.zip` ด้วยชื่อไฟล์ที่อัปโหลด

```bash
cd "$(git rev-parse --show-toplevel)"
unzip -o YOUR_ZIP_FILENAME.zip

git add index.html admin.html assets data supabase README.md .nojekyll .gitignore deploy
# ตรวจรายการไฟล์ก่อน commit
git status --short
git commit -m "Improve OTOP catalog and admin v2.1"
git push origin main
```

สำหรับ Repository นี้ให้ใช้ **Settings → Pages → Source: Deploy from a branch → main / (root)** ตามเดิมได้เลย โดยไฟล์ `deploy/pages.yml.example` เป็นตัวอย่างที่ไม่รันอัตโนมัติ หากภายหลังต้องการย้ายไป GitHub Actions ให้เลือก Source: GitHub Actions ก่อน แล้วคัดลอกตัวอย่างเป็น `.github/workflows/pages.yml`

หลังอัปโหลดผ่านแล้ว ตรวจ:

- เว็บไซต์ https://trakoonintasit-beep.github.io/otop-mae-hong-son-2570/
- Admin https://trakoonintasit-beep.github.io/otop-mae-hong-son-2570/admin.html
- Settings → Pages และแท็บ Actions ของ repo ว่าการเผยแพร่สำเร็จ

**ไม่ต้องอัปโหลดไฟล์ ZIP เข้า Repository โดยตรงโดยไม่แตกไฟล์** เพราะ Pages จะไม่อ่าน HTML ที่อยู่ใน ZIP

## เปิดใช้ Admin ออนไลน์ด้วย Supabase (งานที่ต้องตั้งค่าเพิ่ม)

GitHub Pages เป็น Static Hosting จึงไม่สามารถเก็บบัญชีผู้ดูแลและเขียนฐานข้อมูลให้ทุกคนเห็นได้ด้วยตัวเอง

1. สร้าง Supabase Project **ภายใต้บัญชีหน่วยงานที่รับผิดชอบ**
2. Supabase → **SQL Editor** → รัน `supabase/setup.sql` (ตรวจ SQL ก่อนทำกับฐานข้อมูลที่ใช้งานจริง)
3. Supabase → Authentication → Users → สร้างบัญชีเจ้าหน้าที่ และตั้งรหัสผ่านเฉพาะใน Supabase **ห้ามส่งรหัสผ่านผ่านแชต**
4. Supabase SQL Editor → รันต่อไปนี้โดยแทนอีเมลที่สร้างจริง:

```sql
insert into public.admins(user_id)
select id from auth.users where email = 'REPLACE_WITH_REAL_ADMIN_EMAIL'
on conflict (user_id) do nothing;
```

5. เปิด `assets/config.js` แล้วกำหนด **Project URL** และ **publishable/anon key** จาก Supabase:

```js
window.OTOP_CONFIG = {
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_PUBLISHABLE_OR_ANON_KEY'
};
```

**ห้ามนำ `service_role`, Secret Key, Database Password หรือรหัสผ่านผู้ใช้ไปใส่ในไฟล์นี้หรือ GitHub** เพราะ Repository เป็น Public; Supabase publishable/anon key เปิดเผยได้เมื่อใช้ Row Level Security ถูกต้อง

6. Git commit/push ไฟล์ `assets/config.js` แล้วทดสอบว่า Admin ใช้อีเมล+รหัสผ่านจริง และหน้าเว็บโหลดข้อมูลจากฐานข้อมูลออนไลน์
7. สร้างรายการสินค้าใหม่ ตรวจข้อมูล และเลือก “เผยแพร่บนเว็บไซต์” สำหรับรายการที่ตรวจสอบแล้วเท่านั้น (ระบบออนไลน์ไม่แสดงข้อมูลสาธิต 12 รายการโดยอัตโนมัติ)
8. ก่อนเปิดรับข้อมูลจริง แนะนำให้กำหนดรอบทบทวนข้อมูลผู้ผลิต ราคา เบอร์ติดต่อ และพิกัดร้านอย่างน้อยทุกไตรมาส รวมถึงนโยบายลบ/แก้ไขข้อมูลตามคำขอของเจ้าของข้อมูล

## ข้อควรระวังด้านข้อมูลส่วนบุคคล

- เก็บเฉพาะข้อมูลที่จำเป็นและผู้ประกอบการอนุญาตให้เผยแพร่
- อย่าใส่ที่อยู่บ้านส่วนตัว เบอร์ส่วนตัว หรือพิกัดที่พักอาศัยโดยไม่ได้รับอนุญาต
- หน้าเว็บและ QR Code แชร์ได้สาธารณะ ดังนั้นทุกข้อมูลที่เลือก `is_published=true` ต้องได้รับการตรวจสอบแล้ว
- ไฟล์สำรอง JSON อาจมีเบอร์ติดต่อและพิกัด **ห้ามอัปโหลดไฟล์สำรองที่มีข้อมูลส่วนบุคคลขึ้น GitHub Public**
- `data/products.json` เป็นตัวอย่างเท่านั้น ไม่ใช่ฐานข้อมูลจริงของจังหวัด
- เมื่อตรวจสอบข้อมูลจริงครบแล้วและพร้อมให้ค้นหาผ่าน Google ให้ลบ `<meta name="robots" content="noindex, nofollow" />` ออกจาก `index.html` (ส่วน `admin.html` ควรคง noindex)

## การทดสอบเบื้องต้น

- การแสดงสินค้า 12 รายการ / ปุ่มแสดงเพิ่ม / ค้นหา / ตัวกรอง
- เปิดหน้า Modal และส่วนแชร์สินค้า
- โหมด Admin ทดลอง ตั้งรหัสผ่านและเพิ่มสินค้าแบบฉบับร่าง
- ไวยากรณ์ JavaScript และการมีอยู่ของไฟล์รูปภาพ

**ยังต้องทดสอบบนโฮสต์จริงหลัง Deploy:** Leaflet/OSM Tile, QR Code จาก CDN, Supabase Login, RLS, Storage Upload, ข้อมูลที่แสดงให้ผู้ใช้ต่างเครื่อง, และการตอบสนองมือถือหลายขนาด
