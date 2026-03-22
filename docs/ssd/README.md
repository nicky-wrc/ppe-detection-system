# System Sequence Diagram (SSD) — แยกเป็นไฟล์สำหรับใส่เล่ม

แต่ละไฟล์ `.puml` เป็น **แผนภาพลำดับหนึ่งรูป** ส่งออกเป็น PNG/PDF ได้พอดีกับหน้าเล่ม

| ไฟล์ | หัวข้อ |
|------|--------|
| `01_login_profile.puml` | เข้าสู่ระบบและโหลดโปรไฟล์ |
| `02_register.puml` | ลงทะเบียนขอใช้งาน |
| `03_detect_image.puml` | ตรวจจับ PPE จากรูปภาพ |
| `04_detect_video.puml` | ตรวจจับ PPE จากวิดีโอ |
| `05_history_reports.puml` | ประวัติ รายละเอียด และรายงาน |
| `06_alerts.puml` | แจ้งเตือน |
| `07_settings.puml` | ตั้งค่าส่วนตัว |
| `08_admin.puml` | ผู้ดูแลระบบ (A1–A3) |

## วิธีส่งออกเป็นรูป

1. เปิด [PlantUML Online](https://www.plantuml.com/plantuml/uml) หรือใช้ปลั๊กอินใน VS Code / IntelliJ
2. เปิดทีละไฟล์ แล้ว **Export PNG** หรือ **Export PDF**
3. ตั้งความละเอียด: บางเครื่องมือมี `scale` — ถ้าตัวอักษรเล็ก ให้เพิ่มในไฟล์บรรทัดแรกหลัง `@startuml` เช่น `scale 1.2`

## หมายเหตุ

- ข้อความภาษาไทยใน `actor "..."` ต้องมีเครื่องหมายคำพูด มิฉะนั้น PlantUML จะ error
- ลำดับ **รูป (03)** กับ **วิดีโอ (04)** สอดคล้องกับ `POST /detection/image` และ `POST /detection/video`
