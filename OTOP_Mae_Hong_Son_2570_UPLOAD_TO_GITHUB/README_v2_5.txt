OTOP Mae Hong Son Digital Catalog 2570 - Google Drive Media v2.5

เริ่มต้นที่ INSTALL_GOOGLE_DRIVE_TH.md ก่อนอัปโหลดไฟล์เว็บ

ไฟล์ใน ZIP ใช้รวมกับ repository เดิม (ไม่ใช่เว็บไซต์แบบ standalone)
Google Drive: 1TzmzeKjwgozmewccJPYK0_l54FAJDp-f
ไม่มีรหัสผ่าน, OAuth token, service-role key หรือ secret ใด ๆ อยู่ใน ZIP

สำคัญ:
1. แก้สิทธิ์ Google Drive folder เป็น Restricted
2. สร้าง Apps Script Web App โดยใช้ Code.gs และ Script Property secret
3. ตั้ง Edge Functions secrets ใน Supabase
4. รัน SQL และ Deploy Function 2 ตัว (otop-drive-upload / otop-drive-image)
5. อัปโหลด ZIP ไฟล์ frontend ลง root GitHub repo และรอ Pages success
6. ตรวจสอบการเชื่อมต่อก่อนอัปโหลดรูปใหม่
7. ใช้เมนูย้ายรูปเดิม อย่าเพิ่งลบ Storage เดิม

ชุดนี้รวม Site Editor v2.4 สำหรับเครื่องที่ยังไม่อัปเดต และไม่รวม assets/config.js
