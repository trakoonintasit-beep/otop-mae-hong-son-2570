# OTOP Mae Hong Son Digital Catalog 2570 — เก็บภาพทั้งหมดใน Google Drive (v2.5)

**เว็บไซต์:** https://trakoonintasit-beep.github.io/otop-mae-hong-son-2570/

**โฟลเดอร์ Google Drive เป้าหมาย:** https://drive.google.com/drive/folders/1TzmzeKjwgozmewccJPYK0_l54FAJDp-f

## ก่อนเริ่ม: สิทธิ์โฟลเดอร์ (สำคัญมาก)

โฟลเดอร์ที่ตรวจครั้งก่อนเปิดสิทธิ์ **Anyone / Writer** ซึ่งไม่ปลอดภัย ให้เข้า Google Drive → แชร์ → การเข้าถึงทั่วไป → **จำกัด (Restricted)**; Google Apps Script ที่รันเป็นเจ้าของบัญชียังเข้าถึงโฟลเดอร์ได้ แต่ผู้รู้ลิงก์จะไม่สามารถแก้ไฟล์

**การเก็บรูปใหม่:** Google Drive เท่านั้น (โฟลเดอร์ย่อย `products` และ `website` จะสร้างอัตโนมัติ) ไม่มีการอัปโหลดรูปใหม่ไป Supabase Storage. Supabase ยังเก็บ `products.image`, `otop_site_settings.content.hero_image`, ประวัติ file ID และระบบ Auth แต่ **ไม่เก็บ bytes รูป**.

**การแสดงรูปสาธารณะ:** หน้าเว็บส่งคำขอไปที่ Supabase Edge Function `otop-drive-image` ซึ่งตรวจ file ID ว่าเป็นสื่อของ OTOP ก่อนอ่านภาพจาก Drive ด้วยตัวกลาง Google Apps Script. โฟลเดอร์ Drive ไม่ต้องเปิดแชร์สาธารณะ. นี่เป็น proxy ผ่าน Supabase ไม่ใช่ direct hotlink ไป Drive.

### 1. สร้างตัวกลาง Google Apps Script (ต้องทำครั้งเดียว)

1. ลงชื่อเข้า Google บัญชีที่เป็นเจ้าของโฟลเดอร์ Drive นี้ → https://script.google.com → **New project** ตั้งชื่อ `OTOP Drive Image Bridge`.
2. เปิดไฟล์ `google-apps-script/Code.gs` จาก ZIP นี้ คัดลอกทุกบรรทัดแทน `Code.gs` ของโปรเจกต์ Apps Script → Save.
3. สร้างรหัสลับแบบสุ่ม **อย่างน้อย 32 ตัวอักษร** เช่น สุ่มใน Terminal ของ Codespaces ด้วยคำสั่ง: `python -c "import secrets; print(secrets.token_urlsafe(48))"` (ใช้รหัสจริงที่สุ่มได้ ห้ามใช้ตัวอย่าง)
4. ไปที่ ⚙️ **Project Settings → Script Properties → Add script property** ตั้งชื่อ `OTOP_BRIDGE_KEY`, ค่าเป็นรหัสสุ่มในข้อ 3 → Save. **ห้ามใส่รหัสนี้ใน GitHub หรือเว็บไซต์ `assets/config.js`**.
5. **Deploy → New deployment → Select type: Web app** ตั้ง `Execute as: Me` และ `Who has access: Anyone` → Deploy; อนุญาตสิทธิ์ Google Drive ตามที่ระบบถาม. หาก Workspace ไม่ยอมให้ Anyone ให้ปรึกษาผู้ดูแลบัญชี เพราะการตั้งค่าแบบนี้ต้องให้ฝั่ง Supabase เรียกได้โดยไม่ต้อง Google Sign-in.
6. คัดลอก **Web app URL** ที่ลงท้ายด้วย `/exec` เช่น `https://script.google.com/macros/s/AKfycb.../exec` ไว้สำหรับขั้นตอน Supabase. **อย่าส่งค่ารหัสลับให้คนอื่น**. ตัว Web app URL อาจถูกเปิดได้แต่จะไม่ทำงานหากไม่มีรหัส Bridge.

**คำเตือน:** `Who has access: Anyone` หมายถึงเข้าถึง endpoint ของ Apps Script ได้จากอินเทอร์เน็ต แต่โค้ดตรวจสอบ `OTOP_BRIDGE_KEY` ก่อนอ่านหรือเขียน Drive. ห้ามแก้โค้ดเอาการตรวจนี้ออก. เก็บรหัส Bridge ใน Supabase Secrets เท่านั้น และเปลี่ยนรหัสหากสงสัยว่ารั่ว.

### 2. ตั้ง Supabase Edge Function Secrets

เปิด https://supabase.com/dashboard/project/glzfxtwlqgnybvnbnrpz/settings/functions (หรือ **Edge Functions → Secrets** ตาม Dashboard)

เพิ่ม Secrets 2 ค่า:

| Secret name | Value |
|---|---|
| `OTOP_DRIVE_SCRIPT_URL` | Web app URL `/exec` จาก Apps Script |
| `OTOP_DRIVE_BRIDGE_KEY` | รหัสสุ่มเดียวกับ Script Property |

ไม่ต้องตั้งค่า Service Role Key ใน GitHub หรือ Browser. Supabase จัดเตรียม `SUPABASE_URL` กับ `SUPABASE_SERVICE_ROLE_KEY` ให้ Edge Function ของโปรเจกต์ตามปกติ. **ห้ามเปิดเผย Secrets หรือภาพหน้าจอที่แสดงค่า Secrets**.

### 3. สร้างตารางทะเบียนสื่อ

Supabase → **SQL Editor → New query** → วางโค้ดจาก `supabase/migrations/20261020_google_drive_media.sql` → **Run**. ตารางใหม่ `otop_drive_media` เก็บเฉพาะ Drive File ID, ประเภท, MIME, ขนาด, ผู้อัปโหลด; ไม่เก็บไฟล์รูป. ส่วน v2.4 ต้องมี `otop_site_settings` อยู่แล้ว หากยังไม่มีให้รัน `supabase/migrations/20261020_site_editor.sql` จากไฟล์ ZIP นี้ก่อน.

### 4. Deploy Edge Functions สองชื่อ (จำเป็นทั้งคู่)

Supabase → **Edge Functions → Deploy a new function → Via Editor**

| ชื่อ Function ที่ต้องพิมพ์ตรงตัว | โค้ดที่นำไปวาง | JWT setting |
|---|---|---|
| `otop-drive-upload` | `supabase/functions/otop-drive-upload/index.ts` | **Verify JWT with legacy secret: OFF** |
| `otop-drive-image` | `supabase/functions/otop-drive-image/index.ts` | **Verify JWT with legacy secret: OFF** |

หมายเหตุการตั้ง JWT: เว็บไซต์ใช้ `sb_publishable_...` และ Auth JWT ของผู้ใช้; โค้ด `otop-drive-upload` ตรวจ access token ด้วย `service.auth.getUser` และสิทธิ์ `admins.is_active/role` **ภายใน Function** อย่างชัดเจน แม้ Gateway ปิด legacy JWT check. `otop-drive-image` เป็นจุดอ่านภาพสาธารณะและตรวจ media file ID จากฐานข้อมูลก่อนโหลดไฟล์ Drive. **ห้ามปิดการตรวจสิทธิ์ภายในโค้ด**.

หาก Deploy ด้วย Supabase CLI ให้กำหนด:

```toml
[functions.otop-drive-upload]
verify_jwt = false

[functions.otop-drive-image]
verify_jwt = false
```

ตรวจว่า Function สองตัวอยู่ใน Project `glzfxtwlqgnybvnbnrpz` **อย่า Deploy ลงโปรเจกต์อื่น**.

### 5. อัปโหลด ZIP ลง GitHub Repository

1. สำรอง Repository และ SQL ปัจจุบันก่อน
2. ดาวน์โหลด ZIP v2.5 แล้วใน Codespaces เปิด Terminal ที่ Root Repository
3. อัปโหลด ZIP เข้า Codespaces และแตกไฟล์:

```bash
unzip -o OTOP_Mae_Hong_Son_2570_Google_Drive_v2_5.zip -d .
git status --short
git add admin.html index.html assets/admin.js assets/site-settings.js assets/site-settings-admin.js assets/drive-media.js assets/drive-migration.js assets/drive-media.css supabase/migrations/20261020_google_drive_media.sql supabase/migrations/20261020_site_editor.sql supabase/functions/otop-drive-upload/index.ts supabase/functions/otop-drive-image/index.ts google-apps-script/Code.gs INSTALL_GOOGLE_DRIVE_TH.md
git commit -m "Store OTOP product and cover uploads in Google Drive"
git push origin main
```

ถ้าเวอร์ชัน v2.4 **ยังไม่เคยติดตั้ง** ZIP นี้รวมไฟล์ v2.4 ของหน้าเว็บและ Admin มาแล้ว จึงไม่ต้องอัปโหลด v2.4 แยก แต่ต้องรัน SQL ของ v2.4 (ตามขั้นตอนที่ 3).

ZIP **ไม่รวม `assets/config.js`** และไม่แตะรหัส Admin หรือข้อมูลสินค้า. ตรวจว่าค่า `assets/config.js` ใน GitHub ยังคงเป็นของโปรเจกต์ที่ใช้งานจริง. ไม่ต้อง Deploy Apps Script ผ่าน GitHub.

### 6. ทดสอบก่อนใช้งานจริง

1. เปิด [Admin OTOP](https://trakoonintasit-beep.github.io/otop-mae-hong-son-2570/admin.html) และ Login ด้วย **Admin หลัก**
2. ไปเมนู 🎨 จัดการหน้าเว็บไซต์ → ท้ายหน้า กด **ตรวจสอบการเชื่อมต่อ Google Drive** ต้องขึ้นว่าเชื่อมต่อสำเร็จ
3. อัปโหลดภาพหน้าปกและกดบันทึก; เปิดหน้าเว็บไซต์สาธารณะตรวจว่าภาพแสดงถูกต้อง
4. ในเมนู 📦 จัดการสินค้า เลือกแก้ไขสินค้า → อัปโหลดภาพ JPEG/PNG/WebP → บันทึก → ตรวจรูปในหน้ารายการและหน้าเว็บ
5. เปิด Drive โฟลเดอร์ที่ส่งมา: ควรมี `products` / `website` โดยอัตโนมัติ
6. ลอง Login Admin รอง: สามารถอัปโหลดภาพสินค้า แต่ไม่สามารถอัปโหลดภาพปกหรือจัดการบัญชี Admin (ตรวจบนเซิร์ฟเวอร์)

**รูปใหม่จากกล้องใหญ่** สามารถเลือกต้นฉบับขนาดสูงสุด 15 MB ระบบปรับขนาดและแปลง WebP ก่อนอัปโหลด โดยไฟล์ที่ส่งไปจริงต้องไม่เกิน 5 MB.

### 7. ย้ายรูปเดิม (ก่อนลบ Supabase Storage)

ใน Admin หลัก → 🎨 จัดการหน้าเว็บไซต์ → **ย้ายภาพเดิมที่ใช้อยู่ไป Google Drive**

- ระบบค้น URL ที่อ้างถึง Supabase public `product-images` หรือ `assets/images` ของเว็บไซต์นี้เท่านั้น → คัดลอกรูปไป Drive → เขียน URL ใหม่ในตาราง `products` และ `otop_site_settings`
- เดินทีละรายการ มีสถานะให้เห็นและข้ามรายการที่ผิดพลาด โดยไม่ลบไฟล์เดิม
- สำหรับสินค้าเกิน 1,000 รายการให้ใช้ขั้นตอนย้ายแบบแบ่งชุดเพิ่มเติม (ปุ่มปัจจุบันอ่านได้ไม่เกิน 1,000 รายการต่อครั้ง)
- หลังย้าย **ตรวจเว็บจริงก่อนลบ** ไฟล์เดิมใน Supabase Storage หรือ GitHub; การลบต้องทำเองและไม่รวมในชุดอัปเดต
- รูป placeholder ที่มากับไฟล์เว็บยังอยู่ใน GitHub เพื่อใช้สำรองในโหมดสาธิต ส่วนภาพที่เว็บไซต์ออนไลน์อ้างถึงจะย้ายตามรายการข้างต้น
- หากรายการไม่สำเร็จ รันใหม่ได้ ระบบจะข้ามรูปที่เป็นลิงก์ Drive แล้ว

### การแก้ปัญหา

- **HTTP 404 / Edge Function not found:** Deploy `otop-drive-upload` และ `otop-drive-image` ด้วยชื่อตรงตัวและใน Project เดียวกับ `assets/config.js`
- **Network/CORS:** ตรวจ Preflight/Invocations, Verify JWT with legacy secret OFF, Origin ของเว็บไซต์ `https://trakoonintasit-beep.github.io`, และ Secrets
- **503 Drive bridge not configured:** ตรวจสองค่า `OTOP_DRIVE_SCRIPT_URL` และ `OTOP_DRIVE_BRIDGE_KEY` ใน Supabase Secrets
- **502 หรือ Drive service failed:** ดู Logs ของ Edge Function และ **Apps Script → Executions** ตรวจ deployment `/exec`, สิทธิ์รันเป็นเจ้าของ, อนุญาตสิทธิ์ Drive และโฟลเดอร์ `ROOT_FOLDER_ID`
- **403 Admin access denied:** ตรวจสิทธิ์ Admin ในตาราง `admins` ว่า `is_active=true`, บัญชี Admin หลัก role=`master_admin`
- **ภาพแสดงไม่ขึ้น:** เปิด URL `otop-drive-image?id=...` จากฐานข้อมูล ตรวจว่าตาราง `otop_drive_media` มี Drive ID และ Function `otop-drive-image` ถูก Deploy โดยปิด legacy verify_jwt
- **โฟลเดอร์ยังไม่มีรูป:** หากกดอัปโหลดใน Admin แล้วไม่สำเร็จ อาจเป็นปัญหา Drive quota, Apps Script quota หรือสิทธิ์. ลองปุ่มตรวจสอบการเชื่อมต่อและดู Logs

### ข้อจำกัดและความเป็นส่วนตัว

- Drive สำหรับงานประเภทนี้ไม่ได้เป็น CDN โดยเฉพาะ; การเปิดภาพแต่ละครั้งอาศัย Apps Script และ Edge Function อาจช้าหรือเจอ quota หากมีผู้เข้าชมจำนวนมาก. มี cache header ฝั่ง browser 1 วัน แต่ไม่การันตี CDN cache ของทุกระบบ
- รูปภาพที่เผยแพร่บนเว็บไซต์ **ย่อมเปิดดูได้โดยสาธารณะผ่าน URL ของ OTOP** แม้โฟลเดอร์ Google Drive จะ Restricted; อย่าใช้กับภาพส่วนบุคคล/ภาพภายในที่ไม่ควรเผยแพร่
- ช่อง Admin รับภาพผ่านระบบซึ่งตรวจสมาชิก Admin จริง, ขนาดและชนิดไฟล์ทั้งใน browser, Supabase Edge และ Apps Script และไม่ส่ง Drive token / shared secret ให้ browser
- รหัสลับถูกส่งเฉพาะจาก Supabase Edge ไป Apps Script ผ่าน HTTPS; ต้องเก็บรหัสให้ปลอดภัยและเปลี่ยนเป็นระยะ
- หากบัญชี Google ถูกปิด/ลบ, quota เต็ม หรือ Apps Script ใช้งานไม่ได้ รูปใหม่และรูปเดิมผ่าน proxy อาจไม่แสดง; ทำสำรองแยกตามนโยบายสำนักงาน
- ชุดนี้ไม่ได้อัปโหลด/Deploy สู่ Supabase หรือ Google Apps Script จริงจากเครื่องมือ ChatGPT เพราะยังไม่ได้รับสิทธิ์ Deploy บนบัญชีของคุณ; ต้องทำตามขั้นตอนก่อนใช้งานจริง
