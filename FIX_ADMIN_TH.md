# คู่มือแก้ปัญหาระบบ Admin OTOP 2570 v2.3.1

## สิ่งที่แก้
- ปุ่ม **แสดง / ซ่อน** ในช่องรหัสผ่านของหน้าเข้าสู่ระบบ, ช่องยืนยัน, สร้าง Admin รอง, และเปลี่ยนรหัสผ่าน Admin รอง
- ปุ่ม **ตรวจสอบการเชื่อมต่อ** ในเมนู Admin รอง (ทดสอบสิทธิ์ด้วยคำสั่ง list โดยไม่สร้างหรือเปลี่ยนบัญชี)
- เปลี่ยนข้อความรวม ๆ “ไม่สามารถติดต่อระบบจัดการ Admin” ให้แยกสาเหตุจาก HTTP 401, 403, 404, 500/503, ปัญหา CORS/เครือข่าย ฯลฯ
- ไม่เปิดเผยรหัสผ่านบัญชีเดิม (Supabase Auth ไม่อนุญาตให้อ่านรหัสผ่านย้อนหลัง) สามารถแสดงได้เฉพาะขณะกำลังพิมพ์ และกำหนดใหม่ได้ตามสิทธิ์

## A. อัปเดตหน้าเว็บ (อย่าแก้ไฟล์ assets/config.js)
1. เข้า GitHub Codespaces ของ Repository `trakoonintasit-beep/otop-mae-hong-son-2570`
2. สำรองหรือ commit งานเดิมไว้ก่อน
3. แตก ZIP แล้วอัปโหลดไฟล์ **เฉพาะ** `admin.html`, `assets/admin.js`, `assets/admin.css` เข้าตำแหน่ง root ของ Repository (ไม่ใช่โฟลเดอร์ซ้อน)
4. ตรวจ `git status` แล้ว `git add admin.html assets/admin.js assets/admin.css` ตามด้วย `git commit -m "Fix OTOP admin password visibility and function diagnostics"` และ `git push origin main`
5. รอ GitHub Actions เสร็จ แล้วเข้า `https://trakoonintasit-beep.github.io/otop-mae-hong-son-2570/admin.html` กด Ctrl+F5

## B. แก้เหตุ “สร้างบัญชีไม่สำเร็จ: ไม่สามารถติดต่อระบบจัดการ Admin”
ข้อความเดิมไม่บอกสาเหตุที่แท้จริง แพตช์นี้จะช่วยแยกได้ ตรวจตามลำดับ:

1. เปิด Supabase Dashboard → เลือก **Project เดียวกับ assets/config.js** (ดู Project URL ปัจจุบันใน GitHub โดยไม่คัดลอก Secret)
2. เปิด **Edge Functions** → ตรวจว่า **manage-otop-admins** ปรากฏและสถานะพร้อมใช้งาน หากไม่มี แสดงว่าไม่ได้ Deploy (รัน SQL อย่างเดียวไม่ทำให้ Edge Function ถูกติดตั้ง)
3. ถ้ายังไม่มี: Edge Functions → Deploy a new function → Via Editor → ตั้งชื่อ `manage-otop-admins` → นำโค้ดทั้งหมดจาก `supabase/functions/manage-otop-admins/index.ts` ไปวาง → Deploy
4. ตรวจว่าค่า `SUPABASE_URL` และ `SUPABASE_SERVICE_ROLE_KEY` (ระบบ Supabase เตรียมให้ฝั่งเซิร์ฟเวอร์) ใช้ได้ และ **ห้าม** นำ service role key ลง GitHub หรือใส่ `config.js`
5. ตรวจ **SQL Editor** ว่าเคยรัน `supabase/migrations/20261019_admin_roles.sql` แล้ว และบัญชีหลักมี `role='master_admin'`, `is_active=true`
6. เปิด Authentication → Users ยืนยันว่ามีบัญชี Admin หลักตรงกับที่ล็อกอิน
7. เปิด Edge Functions → `manage-otop-admins` → **Logs / Invocations** ดูสถานะล่าสุดและข้อความผิดพลาด โดยไม่คัดลอกโทเค็นหรือรหัสผ่านส่งมา
8. ออกจากระบบและเข้าสู่ระบบใหม่ เปิดเมนู “จัดการ Admin รอง” กด **ตรวจสอบการเชื่อมต่อ** ก่อนทดสอบสร้างบัญชี

### ข้อความใหม่และความหมาย
- **404 / ไม่พบ Function:** ยังไม่ได้ Deploy หรือชื่อ Function/Project ไม่ตรง
- **401:** JWT ถูกปฏิเสธ / เซสชันหมดอายุ / Verify JWT ไม่สอดคล้องกับการยืนยันตัวตน
- **403:** สิทธิ์ master_admin ยังไม่ถูกต้องหรือ Origin ไม่ได้รับอนุญาต
- **500/503:** Edge Function / ตารางฐานข้อมูล / secret ฝั่งเซิร์ฟเวอร์มีปัญหา — ดู Logs
- **เครือข่าย/CORS:** ไม่สามารถเข้าถึง Edge Function หรือ browser บล็อก request — ดู Network ใน Developer Tools

### ตรวจ SQL แบบอ่านอย่างเดียวใน Supabase SQL Editor
```sql
SELECT a.role, a.is_active, u.email
FROM public.admins a JOIN auth.users u ON u.id = a.user_id
ORDER BY u.email;
```

**ข้อควรระวัง:** ไม่สามารถ “ดูรหัสผ่านเก่า” ของ Admin คนอื่นได้ โดยออกแบบให้รีเซ็ตหรือกำหนดรหัสผ่านใหม่เท่านั้น ระบบรหัสผ่านไม่ควรเก็บเป็นข้อความที่อ่านได้

### ปรับ JWT ใน Supabase
รักษาการตรวจสอบสิทธิ์ของผู้ใช้ไว้เสมอ สำหรับโปรเจกต์นี้ใช้ `sb_publishable_...` ในฝั่งหน้าเว็บ และ Edge Function ฉบับที่แนบมาจะตรวจ `auth.getUser(token)` และบทบาท `master_admin` **ภายในโค้ดอย่างเข้มงวด** ดังนั้นหาก Gateway รายงาน 401 `Invalid JWT` จากการตรวจ JWT แบบเก่า ให้ปิดตัวเลือก `Verify JWT` **เฉพาะฟังก์ชัน `manage-otop-admins`** ใน Dashboard (ตรงกับไฟล์ `supabase/config.toml` ที่ตั้ง `verify_jwt = false`) แล้ว Deploy ใหม่ ไม่ใช่ปิดการตรวจผู้ใช้ภายใน Edge Function และต้องรักษาสองขั้น `getUser(token)` และ role check ไว้


## สำคัญสำหรับเว็บไซต์นี้ (มี Supabase publishable key รูปแบบใหม่)

- GitHub `assets/config.js` ใช้ Publishable Key ที่ขึ้นต้น `sb_publishable_` ซึ่งไม่ใช่ JWT
- Supabase อธิบายว่าระบบ **Verify JWT แบบเดิม** ที่ Edge Gateway อาจตอบ 401 กับคีย์/รูปแบบการเข้ารหัสใหม่ แม้เข้าสู่ระบบแล้ว
- ไฟล์ `supabase/config.toml` ที่ให้ไว้ตั้ง `verify_jwt = false` เฉพาะ Edge Function นี้ และปลอดภัยได้เมื่อเก็บ **การตรวจ JWT จาก Supabase Auth (`auth.getUser`) + ตรวจ `master_admin` ในฐานข้อมูล** ไว้ในฟังก์ชัน อย่าถอดสองขั้นนี้
- ถ้า Deploy ผ่าน Dashboard ไม่ได้อ่าน `config.toml` ต้องตั้งค่า **Verify JWT = Off** ด้วยตนเองที่ Edge Functions → manage-otop-admins → Settings/Details (เฉพาะเมื่อเจอปัญหา 401 จาก legacy gateway)
- แหล่งอ้างอิง Supabase: https://supabase.com/docs/guides/troubleshooting/edge-function-401-error-response
