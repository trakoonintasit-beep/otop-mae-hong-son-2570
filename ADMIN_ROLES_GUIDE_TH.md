# คู่มือเพิ่ม Admin หลัก / Admin รอง — OTOP Mae Hong Son Digital Catalog 2570

## ความสามารถ

- **Admin หลัก**: เพิ่ม/แก้ไข/ลบสินค้า, สร้าง Admin รองด้วย Username + Password + ช่องยืนยันรหัสผ่าน, ดูรายชื่อ, เปิด/ปิดสิทธิ์, กำหนดรหัสผ่านใหม่
- **Admin รอง**: เพิ่ม/แก้ไข/ลบสินค้า และจัดการรูปสินค้าได้ตามสิทธิ์สินค้าเดิม **แต่ไม่เห็นเมนูจัดการผู้ดูแล และเรียก Edge Function เพื่อสร้างผู้ใช้ไม่ได้**
- บัญชีและสิทธิ์อยู่ที่ Supabase Auth และ PostgreSQL ไม่เก็บรหัสผ่านลง JSON หรือ GitHub

## ก่อนติดตั้ง

1. ทำสำเนาหรือ commit ไฟล์เดิมที่ GitHub ไว้ก่อน
2. ต้องเคยรัน `supabase/setup.sql` สร้าง `admins`, `products` และนโยบาย RLS แล้ว
3. มี Supabase Project ที่ใช้กับ `assets/config.js` บน GitHub จริง และบัญชี Admin หลักที่สามารถล็อกอินด้วยอีเมลจริง
4. อย่าส่งรหัสผ่าน, service_role key, access token หรือ SQL ที่มีข้อมูลส่วนบุคคลให้ผู้อื่น

## 1. อัปเดตไฟล์เว็บ (ไม่ต้องแก้ config.js)

ใน Codespaces เปิด Terminal ที่ root ของ Repository แล้วแตก ZIP ที่ดาวน์โหลดไว้ในคอมพิวเตอร์/อัปโหลดไว้ใน Codespaces ไปยัง root โปรเจกต์ โดย **อย่าแทนที่ `assets/config.js`** ควรเห็น `index.html`, `admin.html`, `assets/`, `supabase/` อยู่ระดับบนสุด

ตรวจการเปลี่ยนแปลงและ commit:

```bash
git status
git add admin.html assets/admin.js assets/admin.css supabase/migrations/20261019_admin_roles.sql supabase/functions/manage-otop-admins/index.ts supabase/config.toml ADMIN_ROLES_GUIDE_TH.md
git commit -m "Add master and sub admin management"
git push origin main
```

อัปเดตโค้ดอย่างเดียวจะยังใช้เมนูนี้ไม่ได้ ต้องตั้งค่าฐานข้อมูลและ Edge Function ก่อน

## 2. เพิ่มบทบาท Admin ใน Supabase

1. เปิด Supabase Dashboard → เลือก Project ที่เป็นของเว็บไซต์ OTOP
2. เปิด **SQL Editor → New query**
3. คัดลอกไฟล์ `supabase/migrations/20261019_admin_roles.sql` ไปวางแล้วกด Run
4. ในเมนู Authentication → Users ตรวจสอบว่า **บัญชี Admin หลัก** ถูกสร้างและยืนยันอีเมลแล้ว
5. กลับไป SQL Editor แล้วเปลี่ยน `YOUR_REAL_MASTER_EMAIL` เป็นอีเมลจริงของ Admin หลักก่อนรัน:

```sql
INSERT INTO public.admins(user_id, role, is_active, display_name)
SELECT id, 'master_admin', true, 'Admin หลัก OTOP'
FROM auth.users
WHERE email = 'YOUR_REAL_MASTER_EMAIL'
ON CONFLICT (user_id) DO UPDATE
SET role = 'master_admin', is_active = true;
```

**ข้อควรระวัง:** ข้อความตัวอย่างไม่ใช่อีเมลจริง ห้ามรันก่อนแก้ไข และไม่ควรกำหนด Admin หลักให้ทุกบัญชี หากบัญชีปัจจุบันยังไม่ได้อยู่ใน Auth → Users ต้องสร้างบัญชีก่อน

ตรวจสิทธิ์โดยเรียก (แก้ email ก่อน):

```sql
SELECT a.role, a.is_active, a.username, u.email
FROM public.admins a JOIN auth.users u ON u.id=a.user_id
WHERE u.email='YOUR_REAL_MASTER_EMAIL';
```

ต้องได้ `master_admin` และ `true`

## 3. Deploy Supabase Edge Function

ต้อง Deploy **`manage-otop-admins`** ใน Supabase Project เดียวกับ `assets/config.js` ของเว็บ ขั้นตอนผ่าน Supabase CLI (ใน Codespaces/Terminal ที่ติดตั้ง CLI แล้ว):

```bash
supabase login
supabase functions deploy manage-otop-admins --project-ref YOUR_PROJECT_REF
```

เมื่อ Deploy ให้เปิด **Verify JWT / Verify JWT with legacy secret** ตามการตั้งค่า Auth ของโปรเจกต์ ห้ามปิดการตรวจ JWT โดยไม่มีเหตุผล นอกจากนี้ Edge Function ยังตรวจผู้ใช้และ role ซ้ำที่เซิร์ฟเวอร์เสมอ

ฟังก์ชันใช้ `SUPABASE_URL` และ `SUPABASE_SERVICE_ROLE_KEY` จาก Secret ฝั่ง Supabase เท่านั้น **ห้าม** นำ service role ไปใส่ `assets/config.js` หรือ Repository สาธารณะ

หากต้องการทดสอบจาก URL อื่น นอกจาก `https://trakoonintasit-beep.github.io` ให้เพิ่ม Secret ฝั่ง Edge Function `OTOP_ALLOWED_ORIGINS` เป็น origin ที่อนุญาต (คั่นด้วย `,`) แล้ว Deploy ใหม่

## 4. วิธีใช้งาน Admin หลัก

1. เปิด `https://trakoonintasit-beep.github.io/otop-mae-hong-son-2570/admin.html`
2. เข้าสู่ระบบด้วย **อีเมล Admin หลักจริง** และรหัสผ่านเดิมของ Supabase Auth
3. เลือกเมนู **👥 จัดการ Admin รอง**
4. กรอกชื่อเจ้าหน้าที่, Username (4–24 ตัว เริ่มด้วย a-z), Password (อย่างน้อย 12 ตัว มีตัวอักษร+ตัวเลข) และยืนยัน Password ให้ตรงกัน
5. ติ๊กข้อความยืนยันว่ามีสิทธิ์มอบหมาย และคลิก **ยืนยันและสร้าง Admin รอง**
6. ระบบแสดงกล่องถาม **ยืนยันอีกครั้ง** ก่อนสร้างผู้ใช้จริง
7. ดูบัญชีที่เพิ่มในรายการด้านขวา; เปลี่ยนรหัสผ่านหรือปิดสิทธิ์ได้ภายหลัง

**ตัวอย่าง Username:** `otop_pai`, `cdd_mhs_01` ไม่ต้องพิมพ์โดเมนอีเมล

## 5. วิธีเข้าใช้งาน Admin รอง

Admin รองเปิดหน้า `admin.html` เดียวกัน กรอก **Username** เช่น `otop_pai` และ Password ที่ได้รับจาก Admin หลัก ระบบแปลง Username เป็นอีเมลภายในที่ไม่ใช้รับเมลโดยอัตโนมัติก่อนเข้าสู่ Supabase Auth

บัญชีแบบ Username นี้ **ไม่สามารถขอรหัสผ่านใหม่ผ่านอีเมล** เพราะใช้โดเมนอีเมลภายในที่ไม่มีบริการอีเมล หากลืมรหัสผ่าน ให้ Admin หลักใช้ปุ่ม **เปลี่ยนรหัส** และแจ้งผ่านช่องทางส่วนตัวที่ปลอดภัย

## 6. ข้อควรระวังด้านความปลอดภัย

- ตรวจสิทธิ์ `master_admin` และ `is_active` บน Supabase Edge Function ทุกคำสั่ง ไม่ใช้การซ่อนเมนูเป็นการป้องกันเพียงอย่างเดียว
- Admin รองที่ถูกปิดสิทธิ์จะถูกปฏิเสธการเพิ่ม แก้ไข ลบสินค้าในฐานข้อมูลโดย RLS (แม้ JWT เดิมยังไม่หมดอายุ)
- การเปลี่ยนรหัสผ่านไม่ได้รับประกันว่าจะยกเลิก session เดิมทุกอุปกรณ์ทันที หากสงสัยว่าบัญชีรั่วไหล ให้ปิดสิทธิ์ก่อน ตรวจ log และดำเนินการเพิกถอน session ตามคู่มือ Supabase Auth
- ไม่ใส่รหัสผ่านจริงลงในตัวอย่างโค้ด หน้าเว็บ หรือเอกสาร
- ไม่เผยแพร่เบอร์โทรหรือพิกัดส่วนบุคคลโดยไม่ได้รับอนุญาต
- แนะนำใช้บัญชี Admin หลักอย่างน้อยหนึ่งบัญชีที่หน่วยงานควบคุมและมีวิธีสำรองการเข้าถึงที่เหมาะสม

## สถานะการติดตั้งในแชตนี้

เป็นชุดโค้ด **พร้อมนำไปติดตั้ง** ไม่ใช่ระบบที่เปิดใช้งานบนเว็บจริงแล้ว เนื่องจากการเชื่อมต่อ Supabase ในแชตนี้ยังไม่แสดง Project ใดให้จัดการ และ GitHub Connector ไม่อนุญาตเขียนไฟล์โดยตรง
