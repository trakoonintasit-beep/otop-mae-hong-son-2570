# คู่มือติดตั้ง OTOP Mae Hong Son 2570 — v2.8 Dashboard + เจ้าหน้าที่อำเภอ / v2.9 One Page Premium

**สถานะ:** ชุดอัปเดตโค้ด ยังไม่ได้ติดตั้ง/ทดสอบกับ Supabase และ GitHub Pages ของบัญชีคุณจริง

## สิ่งที่จะได้

- `dashboard.html` — Dashboard ข้อมูลสินค้า 7 อำเภอ ตัวเลขจริงจาก Supabase (รายการสินค้า ผู้ผลิต สินค้าเผยแพร่/แนะนำ) แผนภูมิอำเภอและหมวด
- `district.html` — เจ้าหน้าที่อำเภอเพิ่ม/เสนอแก้ไขข้อมูลในอำเภอที่ได้รับมอบหมายและติดตามสถานะคำขอ พร้อมอัปโหลดภาพไป Google Drive เดิม
- `review.html` — Admin หลักเปรียบเทียบค่าก่อน–หลังและอนุมัติ/ตีกลับ พร้อมบันทึกประวัติคำขอ
- `admin.html` — เพิ่มเมนู Dashboard, เจ้าหน้าที่อำเภอ, อนุมัติสินค้า และเลือกบทบาท/อำเภอเมื่อสร้างบัญชี (ผ่าน patcher)
- `report.html` — One Page A4 Premium โทนเขียวทอง เน้นภาพ/ราคา/เรื่องราว มีภาพเสริม 2 รูปจาก Google Drive และยังใช้เทมเพลตราชการเดิมได้

> ข้อควรทราบ: **อนุมัติสินค้าใหม่** จะสร้างเป็นฉบับร่างก่อน Admin จึงต้องตรวจและเปิดเผยแพร่ในเมนูจัดการสินค้าอีกครั้งเพื่อป้องกันการเผยแพร่โดยไม่ตั้งใจ ส่วนการอนุมัติแก้ไขสินค้าเดิมที่เผยแพร่จะทำให้ข้อมูลที่อนุมัติปรากฏบนเว็บไซต์ทันที

## ขั้นตอนที่ 1: สำรองไฟล์และตรวจรุ่นเว็บไซต์

ใน GitHub Codespaces เปิดโฟลเดอร์ Root `otop-mae-hong-son-2570` ที่มี `admin.html` `report.html` และ `assets/` แล้วตรวจ:

```bash
git status -sb
ls admin.html report.html assets/admin.js assets/one-page-report.js
```

ให้ Commit/สำรองงานที่แก้ไขค้างให้เรียบร้อยก่อน หากมี `CONFLICT` หรือ Rebase ค้าง **ห้ามอัปเดตทับตอนนี้** ให้แก้ให้เรียบร้อยก่อน ห้ามใช้ `git push --force`

## ขั้นตอนที่ 2: Supabase SQL Editor (จำเป็น)

เปิด: https://supabase.com/dashboard/project/glzfxtwlqgnybvnbnrpz/sql/new

**ต้องติดตั้งฐานข้อมูลจากเวอร์ชัน 2.3 และ 2.7 เดิมเรียบร้อยแล้ว** โดยต้องมีตาราง `public.products`, `public.admins`, `public.otop_product_report_details` และฟังก์ชัน `public.is_otop_master_admin()`.

รัน SQL ต่อไปนี้ **ทีละไฟล์** ตามลำดับ แล้วดูข้อความ Success:

1. `supabase/migrations/20261021_district_workflow_v28.sql`
2. `supabase/migrations/20261021_premium_gallery_v29.sql`

ไฟล์แรกเพิ่มบทบาท `district_officer` + `district`, ตารางคำขอ `otop_district_requests`, RLS ที่จำกัดสิทธิ์เจ้าหน้าที่ และฟังก์ชัน `otop_review_request` สำหรับอนุมัติอย่างเป็นธุรกรรม (ไม่ใช่การแก้ผ่านหน้าเว็บโดยตรง)

ไฟล์ที่สองเพิ่ม URL ภาพเสริม 2 ช่องลงในตาราง One Page (ไม่เพิ่มภาพลง Supabase Storage)

**สำคัญ:** การเปลี่ยน RLS จะบังคับใช้ทันที ควรทดสอบด้วยบัญชี Admin หลัก/รองที่มีอยู่ก่อนสร้างเจ้าหน้าที่อำเภอ

## ขั้นตอนที่ 3: อัปเดต Edge Function ที่มีอยู่

เปิด: https://supabase.com/dashboard/project/glzfxtwlqgnybvnbnrpz/functions

เข้า Function **`manage-otop-admins` ที่มีอยู่แล้ว** (อย่าสร้าง Function ชื่ออื่น) แล้วนำโค้ด **ทั้งไฟล์** จาก `supabase/functions/manage-otop-admins/index.ts` ไป Deploy เวอร์ชันใหม่ผ่าน Code Editor หรือผ่าน Supabase CLI

โค้ดนี้ขยายคำสั่ง `create` ให้ Admin หลักเลือกประเภทบัญชี `sub_admin` หรือ `district_officer` และอำเภอได้ รวมทั้งรายการบัญชี การปิดสิทธิ์ และรีเซ็ตรหัสผ่าน โดยตรวจสิทธิ์ `master_admin` ฝั่งเซิร์ฟเวอร์เหมือนเดิม **ห้ามใส่ Service Role Key ลง GitHub หรือ config.js**

ใช้การตั้งค่า Verify JWT ที่เคยทำงานได้จริงกับ `manage-otop-admins` เดิม โดยยังต้องตรวจสิทธิ์และ access token ภายใน Function เสมอ

## ขั้นตอนที่ 4: อัปโหลดชุดใหม่ขึ้น GitHub Codespaces

อัปโหลด ZIP ไปที่ **Root** (ตำแหน่งเดียวกับ `admin.html`) ไม่ใช่โฟลเดอร์ย่อย จากนั้น:

```bash
unzip -o OTOP_Mae_Hong_Son_2570_v2_8_v2_9_UPDATE.zip -d .
python3 patch_v28_v29_existing.py
```

คำสั่ง patch จะสำรอง `admin.html`, `report.html`, `assets/admin.js`, `assets/one-page-report.js` เป็นไฟล์ลงท้าย `.bak-v28-v29` **เฉพาะใน Codespaces** แล้วปรับไฟล์จริงใน Root ตัวช่วยสามารถรันซ้ำได้โดยไม่เพิ่มเมนูซ้ำ

ตรวจ:

```bash
node --check assets/admin.js
node --check assets/one-page-report.js
node --check assets/district-portal.js
node --check assets/district-review.js
ls dashboard.html district.html review.html
```

**อย่าอัปโหลด `.bak-v28-v29` หรือ `assets/config.js` ใหม่ขึ้น GitHub โดยไม่จำเป็น**  และอย่าอัปโหลดรูปที่ไม่อนุญาตให้เผยแพร่

## ขั้นตอนที่ 5: Commit/Push เฉพาะไฟล์ที่เปลี่ยนจริง

```bash
git add admin.html report.html dashboard.html district.html review.html \
  assets/admin.js assets/one-page-report.js \
  assets/district-workflow.css assets/district-dashboard.js \
  assets/district-portal.js assets/district-review.js \
  assets/district-admin-links.js assets/one-page-premium.css \
  assets/one-page-premium.js \
  supabase/migrations/20261021_district_workflow_v28.sql \
  supabase/migrations/20261021_premium_gallery_v29.sql \
  supabase/functions/manage-otop-admins/index.ts \
  patch_v28_v29_existing.py INSTALL_V28_V29_TH.md

git status --short
git commit -m "Add OTOP district workflow and premium One Page v2.8 v2.9"
git push origin main
```

หาก `git push` ถูกปฏิเสธ `fetch first` ให้ **หยุดและตรวจ `git status -sb`** ก่อน ไม่ใช้ force push เพราะอาจมีไฟล์คนอื่นแก้ล่าสุด

## ขั้นตอนที่ 6: ทดสอบบัญชีและเมนู

หลัง GitHub Pages Actions ผ่านสีเขียวและกด Ctrl+Shift+R:

1. เข้า Admin: https://trakoonintasit-beep.github.io/otop-mae-hong-son-2570/admin.html
2. เข้าด้วย Admin หลัก เปิด **จัดการ Admin รอง** แล้วเลือกประเภท **เจ้าหน้าที่ประจำอำเภอ** และหนึ่งใน 7 อำเภอเพื่อสร้างบัญชีใหม่
3. Login ด้วย username เจ้าหน้าที่ผ่านหน้า Admin เดิม ระบบจะนำไป `district.html` และให้เสนอสินค้า/แก้ไขได้เฉพาะพื้นที่
4. เมื่อกดส่งข้อเสนอ ให้ Admin หลักเปิด `review.html` ดูความเปลี่ยนแปลงแล้ว **อนุมัติ/ตีกลับ**
5. เปิด `dashboard.html` ตรวจว่ายอดสินค้าเป็นยอดฐานข้อมูลจริง (ไม่ใช่ยอดพรีวิว)
6. เปิด `report.html` เลือก **แบบ B · Premium Storytelling** เพิ่มภาพเสริมได้จาก Google Drive และทดสอบ PNG/PDF

## โครงสร้างสิทธิ์

| สิทธิ์ | Admin หลัก | Admin รอง | เจ้าหน้าที่อำเภอ |
|---|---|---|---|
| Dashboard จังหวัด | ดูทั้งหมด | ดูทั้งหมด | ดูเฉพาะอำเภอตนเอง |
| แก้สินค้าโดยตรง | ได้ | ได้ | **ไม่ได้** (ส่งอนุมัติ) |
| แก้สินค้าข้ามอำเภอ | ได้ | ได้ | ไม่ได้ |
| อนุมัติ/ตีกลับคำขอ | ได้ | ไม่ได้ | ไม่ได้ |
| สร้างบัญชีเจ้าหน้าที่ | ได้ | ไม่ได้ | ไม่ได้ |
| One Page | ทุกสินค้า | ทุกสินค้า | เฉพาะสินค้าของอำเภอตนเอง |

## ข้อจำกัดที่ควรทราบ

- ตัวอย่างพรีวิวใน ZIP แยกเป็นไฟล์ PNG ที่ส่งให้ ไม่ใช่ยอดสถิติจริงของจังหวัด
- Dashboard นี้นับรายการสินค้า ไม่ใช่ยอดขายจริง จึงยังไม่มี Top สินค้าขายดีที่สุดจนกว่าจะมีระบบคำสั่งซื้อ
- การใช้ Google Drive เก็บภาพยังมีข้อจำกัดจำนวนคำขอผ่าน Apps Script และ Edge Function เหมือนเวอร์ชันก่อน
- เมนู Google Sheets CSV เดิมยังรองรับการแก้ข้อมูลโดย Admin หลัก/รองเท่านั้น; เจ้าหน้าที่อำเภอใช้ฟอร์มเสนอข้อมูลเพื่อตรวจทาน
- RLS และ Edge Function ยังไม่ได้ทดสอบกับ Supabase โปรเจกต์จริง เพราะเครื่องมือที่เชื่อมอยู่ไม่มีสิทธิ์เข้าถึงโปรเจกต์นั้น ต้องตรวจ SQL และสิทธิ์ในระบบจริงหลังติดตั้ง
- รูปภาพ การเผยแพร่ และข้อมูลที่มีมาตรฐาน/รางวัล ต้องได้รับการยืนยันความถูกต้องโดยเจ้าหน้าที่ก่อนใช้เป็นเอกสารรายงานหรือสื่อขาย
