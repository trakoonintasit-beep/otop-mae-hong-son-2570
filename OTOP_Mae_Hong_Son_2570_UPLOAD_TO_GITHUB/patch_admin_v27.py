#!/usr/bin/env python3
"""Add the OTOP v2.7 One Page button to EXISTING admin.html without replacing its markup."""
from pathlib import Path
p=Path(__file__).resolve().parent / 'admin.html'
if not p.is_file():
    raise SystemExit('ไม่พบ admin.html — โปรดรันจากโฟลเดอร์หลัก Repository')
source=p.read_text(encoding='utf-8')
if 'assets/one-page-launcher.js' in source:
    print('หน้า Admin มีระบบ One Page อยู่แล้ว ไม่ต้องเพิ่มซ้ำ')
else:
    pos=source.lower().rfind('</body>')
    if pos<0 or 'id="adminProductRows"' not in source:
        raise SystemExit('โครงสร้าง admin.html ไม่ตรงกับเวอร์ชันที่รองรับ — ยังไม่แก้ไฟล์')
    snippet='  <script src="assets/one-page-launcher.js" defer></script>\n'
    source=source[:pos]+snippet+source[pos:]
    p.write_text(source,encoding='utf-8')
    print('เพิ่มปุ่ม One Page ในหน้า Admin เรียบร้อยแล้ว')
