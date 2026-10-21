#!/usr/bin/env python3
"""Apply non-destructive v2.8/v2.9 modifications to a CURRENT v2.7 website root.
Run only after extracting v2.8/v2.9 new files; backups are written to .bak-v28-v29.
"""
from pathlib import Path
r=Path(__file__).resolve().parent
p=r/'admin.html';j=r/'assets/admin.js';h=r/'report.html';x=r/'assets/one-page-report.js'
for f in (p,j,h,x):
 if not f.exists():raise SystemExit('ไม่พบ '+str(f)+' ต้องเรียกใช้จากโฟลเดอร์ Root ที่มีไฟล์เว็บเดิม')
 if not f.with_name(f.name+'.bak-v28-v29').exists():f.with_name(f.name+'.bak-v28-v29').write_bytes(f.read_bytes())
s=p.read_text()
if 'assets/one-page-launcher.js' not in s:s=s.replace('</body>','<script src="assets/one-page-launcher.js" defer></script>\n</body>')
if 'assets/district-admin-links.js' not in s:s=s.replace('</body>','<script src="assets/district-admin-links.js" defer></script>\n</body>')
if 'id="newAdminRole"' not in s:
 anchor='<label>กำหนด Password '
 if anchor not in s:raise SystemExit('ฟอร์ม admin.html ไม่ตรงรุ่น กรุณาส่งไฟล์เพื่อตรวจ')
 d=['เมืองแม่ฮ่องสอน','ปาย','ปางมะผ้า','ขุนยวม','แม่ลาน้อย','แม่สะเรียง','สบเมย']
 options=''.join(f'<option value="{district}">{district}</option>' for district in d)
 fields='<label>ประเภทบัญชี<select id="newAdminRole"><option value="sub_admin">Admin รอง (ทุกอำเภอ)</option><option value="district_officer">เจ้าหน้าที่ประจำอำเภอ (จำกัดสิทธิ์)</option></select></label><label id="newAdminDistrictRow" hidden>อำเภอที่รับผิดชอบ<select id="newAdminDistrict"><option value="">เลือกอำเภอ</option>'+options+'</select></label>'
 s=s.replace(anchor,fields+anchor,1)
p.write_text(s)
s=j.read_text()
s=s.replace("else currentRole=data?.role==='master_admin'?'master_admin':'sub_admin';", "else currentRole=data?.role==='master_admin'?'master_admin':data?.role==='district_officer'?'district_officer':'sub_admin';")
s=s.replace('async function showDashboard(){\n  signedIn=true;', "async function showDashboard(){\n  signedIn=true;\n  if(A.configured&&currentRole==='district_officer'){location.replace('district.html');return;}")
if "$('#newAdminRole').addEventListener" not in s:s=s.replace("$('#createAccountForm').addEventListener('submit',createSubAdmin);", "$('#createAccountForm').addEventListener('submit',createSubAdmin);\n  $('#newAdminRole').addEventListener('change',()=>{$('#newAdminDistrictRow').hidden=$('#newAdminRole').value!=='district_officer';});")
s=s.replace("await adminOperation({action:'create',username,display_name,password});", "await adminOperation({action:'create',username,display_name,password,role:$('#newAdminRole').value,district:$('#newAdminRole').value==='district_officer'?$('#newAdminDistrict').value:null});")
if 'const roleTitle=row.role' not in s:s=s.replace("const id=A.esc(row.user_id),status=row.is_active!==false;", "const id=A.esc(row.user_id),status=row.is_active!==false;const roleTitle=row.role==='district_officer'?'เจ้าหน้าที่อำเภอ'+(row.district||''):'Admin รอง';")
s=s.replace("A.esc(row.username)+'</small>'", "A.esc(row.username)+' · '+A.esc(roleTitle)+'</small>'")
s=s.replace("if(!confirm('ยืนยันสร้าง Admin รองชื่อ '+username+'?\\nเจ้าหน้าที่คนนี้จะเพิ่ม แก้ไข และลบข้อมูลสินค้าได้'))return;", "if(!confirm('ยืนยันสร้างบัญชี '+username+' ตามบทบาทที่เลือก?'))return;")
j.write_text(s)
s=h.read_text()
if 'assets/one-page-premium.css' not in s:s=s.replace('</head>','<link rel="stylesheet" href="assets/one-page-premium.css">\n</head>')
if 'assets/one-page-premium.js' not in s:s=s.replace('</body>','<script src="assets/one-page-premium.js" defer></script>\n</body>')
if 'assets/drive-media.js' not in s:s=s.replace('<script src="assets/shared.js"></script>','<script src="assets/shared.js"></script>\n<script src="assets/drive-media.js"></script>')
s=s.replace('<option value="showcase">แบบ B · ประชาสัมพันธ์สินค้า</option>','<option value="showcase">แบบ B · Premium Storytelling (แนะนำสำหรับขาย)</option>')
if 'data-extra="secondary_image_1"' not in s:
 target='<label>มาตรฐาน / การรับรอง'
 html='''<label>ภาพสินค้าเสริม 1 (แกลเลอรี Premium)<input data-extra="secondary_image_1" maxlength="600" placeholder="URL รูปจาก Google Drive"></label>
   <label>ภาพสินค้าเสริม 2<input data-extra="secondary_image_2" maxlength="600" placeholder="URL รูปจาก Google Drive"></label>
   <label>อัปโหลดภาพเสริมเข้า Google Drive (เลือกภาพได้ทีละรูป)<input id="premiumUpload" type="file" accept="image/png,image/jpeg,image/webp"></label>
   <button type="button" id="premiumUploadButton" class="btn btn-subtle">อัปโหลดภาพแล้วใส่ในช่องที่ว่าง</button>
   '''
 if target not in s:raise SystemExit('โครงสร้าง report.html ไม่ตรงรุ่น')
 s=s.replace(target,html+target,1)
h.write_text(s)
s=x.read_text()
if "'secondary_image_1'" not in s:s=s.replace("'report_note','reporter'", "'report_note','reporter','secondary_image_1','secondary_image_2'")
if 'let officerDistrict=null;' not in s:
 s=s.replace('let lastQrLink=\'\';', 'let lastQrLink=\'\';\nlet officerDistrict=null;')
 s=s.replace(".select('user_id,role,is_active')", ".select('user_id,role,is_active,district')")
 s=s.replace("  authorizedUser=user;", "  officerDistrict=member.data.role==='district_officer'?member.data.district:null;\n  if(officerDistrict&&!DISTRICTS.includes(officerDistrict))return deny('บัญชีเจ้าหน้าที่ไม่มีอำเภอที่ได้รับมอบหมาย');\n  authorizedUser=user;")
 s=s.replace("let startAt=0;", "let startAt=0;")
 s=s.replace("const r=await O.client().from('products').select('*').order('id',{ascending:false}).range(startAt,startAt+limit-1);", "let query=O.client().from('products').select('*');\n      if(officerDistrict)query=query.eq('district',officerDistrict);\n      const r=await query.order('id',{ascending:false}).range(startAt,startAt+limit-1);")
 s=s.replace("    $('districtSelect').innerHTML='<option value=\"\">ทุกอำเภอ</option>'+DISTRICTS.map(d=>", "    $('districtSelect').innerHTML='<option value=\"\">ทุกอำเภอ</option>'+DISTRICTS.map(d=>")
 # Officer cannot switch districts in this UI even though published products are public.
 s=s.replace("    const requested=queryId();", "    if(officerDistrict){$('districtSelect').value=officerDistrict;$('districtSelect').disabled=true;}\n    const requested=queryId();")
x.write_text(s)
# Gallery upload is handled by a separate enhancement JS module.
x.write_text(s)
print('สำเร็จ: เพิ่ม Dashboard/เจ้าหน้าที่อำเภอ/อนุมัติ และ One Page Premium โดยสำรองไฟล์เดิม .bak-v28-v29')
