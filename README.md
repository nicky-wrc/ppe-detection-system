# PPE Detection System

ระบบตรวจจับการสวมใส่อุปกรณ์ป้องกันส่วนบุคคลสำหรับงานด้านความปลอดภัยในพื้นที่ปฏิบัติงาน โดยตรวจจับบุคคล หมวกนิรภัย และเสื้อสะท้อนแสงจากรูปภาพ วิดีโอ กล้อง USB และแหล่งสัญญาณ RTSP พร้อมระบบยืนยันเหตุการณ์ข้ามหลายเฟรม การเก็บหลักฐาน การแจ้งเตือน รายงาน และการควบคุมสิทธิ์ตามบทบาท

ผู้จัดทำ: Nicky และ Krit

โครงการนี้เป็นระบบต้นแบบเชิงวิชาการและระบบสนับสนุนการตัดสินใจ ไม่ใช่อุปกรณ์ควบคุมความปลอดภัยที่ผ่านการรับรอง และไม่สามารถใช้แทนการกำกับดูแลของเจ้าหน้าที่ความปลอดภัยได้

## ความสามารถหลัก

- เข้าสู่ระบบด้วย JWT และกำหนดสิทธิ์เป็น `viewer`, `safety_officer` หรือ `admin`
- แดชบอร์ดแสดงสถิติ ภาพรวมแนวโน้ม เหตุการณ์ล่าสุด และจำนวนกล้องออนไลน์จากข้อมูลส่วนกลาง
- ตรวจจับ `person`, `helmet` และ `safety-vest`
- รองรับการตรวจจับจากรูปภาพ วิดีโอ เฟรมภาพ กล้อง USB และแหล่งสัญญาณ RTSP
- ยืนยันการฝ่าฝืนจากหลายเฟรมเพื่อลดการแจ้งเตือนผิดพลาด
- กำหนด PPE ที่จำเป็นตามโซน และกำหนดระดับความเสี่ยงของโซนได้
- บันทึก Snapshot และคลิปเหตุการณ์ พร้อมเบลอบริเวณศีรษะแบบ best effort ก่อนบันทึกหลักฐานจากกล้อง
- แสดง Alert แบบเรียลไทม์ผ่าน WebSocket และส่งอีเมลผ่าน SMTP เมื่อกำหนดค่าไว้
- รวม Reports และ Alerts ไว้ในหน้าศูนย์ตรวจสอบเดียวกัน
- เปิดดูรายละเอียดผลตรวจจับ รูปผลลัพธ์ วิดีโอ และหลักฐานเหตุการณ์ผ่าน endpoint ที่ต้องยืนยันตัวตน
- ส่งออกรายงานจากหน้าเว็บเป็น PDF
- จัดการผู้ใช้ บทบาท สถานะบัญชี กล้อง และโซนตามสิทธิ์ที่กำหนด
- ใช้ Alembic สำหรับ migration และรองรับการทำงานด้วย Docker Compose

หมายเหตุ: โค้ดหน้าอัปโหลดไฟล์แบบเดิมยังคงอยู่แต่ถูกปิดจากเส้นทางหน้าเว็บปัจจุบัน การตรวจจับจากไฟล์ยังใช้งานได้ผ่าน API สำหรับ `admin` และ `safety_officer`

## สิทธิ์การใช้งานตามบทบาท

ข้อมูลที่ Viewer อ่านได้เป็นข้อมูลส่วนกลางของระบบ ไม่ได้จำกัดเฉพาะรายการที่ผู้ใช้นั้นสร้าง

| ความสามารถ                                                            |     Viewer     | Safety Officer | Administrator |
| ------------------------------------------------------------------------------- | :------------: | :------------: | :------------: |
| ดู Dashboard สถิติ และกราฟ                                        | อ่านได้ | อ่านได้ | อ่านได้ |
| ดูประวัติและรายละเอียดการตรวจจับ                | อ่านได้ | อ่านได้ | อ่านได้ |
| ดูรูป วิดีโอ Snapshot และคลิปหลักฐาน                   | อ่านได้ | อ่านได้ | อ่านได้ |
| ดู Alerts และ Events                                                       | อ่านได้ | อ่านได้ | อ่านได้ |
| ดูข้อมูลและสถานะกล้องผ่าน API                          | อ่านได้ | อ่านได้ | อ่านได้ |
| เปิด Live Preview ที่ไม่เบลอ                                      |  ไม่ได้  |     ได้     |     ได้     |
| ตรวจจับจากรูป วิดีโอ หรือเฟรมภาพ                  |  ไม่ได้  |     ได้     |     ได้     |
| Acknowledge และ Resolve เหตุการณ์                                   |  ไม่ได้  |     ได้     |     ได้     |
| Test, Start และ Stop กล้องที่ลงทะเบียนแล้ว              |  ไม่ได้  |     ได้     |     ได้     |
| แก้การตั้งค่าการตรวจจับของตนเอง                  |  ไม่ได้  |     ได้     |     ได้     |
| ค้นหา ลงทะเบียน แก้ไข และลบกล้อง                   |  ไม่ได้  |  ไม่ได้  |     ได้     |
| สร้าง แก้ไข และปิดใช้งานโซน                            |  ไม่ได้  |  ไม่ได้  |     ได้     |
| สร้างผู้ใช้ กำหนด Role และเปลี่ยนสถานะบัญชี |  ไม่ได้  |  ไม่ได้  |     ได้     |

ข้อจำกัดของหน้าเว็บปัจจุบัน:

- Viewer ไม่มีหน้า Live Camera แต่ยังดูจำนวนกล้องออนไลน์บน Dashboard และอ่านข้อมูลกล้องผ่าน API ได้
- หน้า Reports & Alerts เน้นรายการ Alert และรายละเอียด Detection รายการ Event ที่ไม่ได้เชื่อมกับ Alert จะยังไม่แสดงเป็นรายการแยกในหน้าเว็บ
- Backend รองรับการแก้ไขกล้องและสร้างหรือลบโซน แต่หน้าเว็บสำหรับงานดูแลระบบส่วนนี้ยังไม่ครอบคลุมทุกคำสั่ง

## เส้นทางหน้าเว็บ

| URL              | ผู้มีสิทธิ์        | รายละเอียด                                                                        |
| ---------------- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| `/login`       | บุคคลทั่วไป        | เข้าสู่ระบบ                                                                      |
| `/`            | ทุกบทบาท              | Dashboard และข้อมูลภาพรวมส่วนกลาง                                    |
| `/detect`      | Safety Officer, Administrator | ตรวจจับจากกล้อง ดู Preview และควบคุมกล้องตามสิทธิ์  |
| `/camera`      | Safety Officer, Administrator | เปลี่ยนเส้นทางไป`/detect` เพื่อรองรับ URL เดิม             |
| `/reports`     | ทุกบทบาท              | ประวัติ รายละเอียด กรองข้อมูล และส่งออกรายงาน PDF |
| `/alerts`      | ทุกบทบาท              | ใช้หน้าร่วมกับ Reports สำหรับตรวจสอบ Alert และหลักฐาน  |
| `/settings`    | Safety Officer, Administrator | ตั้งค่าการตรวจจับของบัญชีผู้ใช้ปัจจุบัน              |
| `/admin/users` | Administrator                 | สร้างผู้ใช้ กำหนด Role และเปิดหรือปิดบัญชี               |

เส้นทาง `/detection` และหน้าอัปโหลดไฟล์เดิมถูกพักการแสดงผลไว้ในโค้ด จึงไม่ใช่เส้นทางที่เปิดใช้งานในหน้าเว็บปัจจุบัน

## สถาปัตยกรรม

```text
Browser
  |
  | HTTP, protected media, MJPEG, WebSocket
  v
React + TypeScript + Vite
  |
  v
FastAPI
  |-- Authentication and RBAC
  |-- Detection and analytics API
  |-- Camera runtime
  |-- Alert, event and evidence services
  |-- WebSocket broadcaster
  |-- SMTP delivery
  |
  +--> PostgreSQL
  +--> Upload and evidence storage
  +--> YOLO PPE model and person-assist model
```

ลำดับการประมวลผลกล้องโดยสรุป:

```text
USB or RTSP source
  -> Capture frame
  -> Person and PPE inference
  -> Apply zone rules
  -> Confirm violation across temporal window
  -> Create detection, event and alert
  -> Save privacy-filtered evidence
  -> Broadcast realtime update
  -> Send email when SMTP is configured
```

Camera runtime, rate limiter, WebSocket connection state และงานประมวลผลกล้องยังทำงานอยู่ใน process ของ API เหมาะกับ edge pilot แบบ instance เดียว หากต้องรัน API หลาย replica ต้องแยกงานกล้องออกเป็น worker และใช้ shared state หรือ message broker ก่อน

## เทคโนโลยีที่ใช้

### Backend

- Python 3.11
- FastAPI 0.109.2 และ Uvicorn 0.27.1
- SQLAlchemy 2.0.25 และ Alembic 1.13.1
- PostgreSQL 15
- Pydantic 2.6.1
- OAuth2 password form, JWT HS256, Passlib และ bcrypt
- Ultralytics 8.4.23, OpenCV, NumPy และ Pillow
- Pytest 8

### Frontend

- React 19
- TypeScript 5.9 แบบ strict
- Vite/Rolldown 7
- Tailwind CSS 4
- React Router 7
- Axios และ Zustand
- Recharts
- jsPDF และ html2canvas
- Lucide React และ react-hot-toast

### Deployment

- Docker Compose
- PostgreSQL 15 Alpine
- Python 3.11 container สำหรับ Backend
- Node.js 20 container สำหรับ Frontend

## โครงสร้างโครงการ

```text
ppe-detection-system/
|-- backend/
|   |-- alembic/              Database migrations
|   |-- app/
|   |   |-- api/              REST and WebSocket endpoints
|   |   |-- core/             Configuration, security and shared helpers
|   |   |-- db/               Database session and base model
|   |   |-- ml/               Training and evaluation commands
|   |   |-- models/           SQLAlchemy models
|   |   |-- schemas/          Pydantic request and response schemas
|   |   `-- services/         Detection, camera, alert and evidence logic
|   |-- mlops/                Dataset and experiment guidance
|   |-- scripts/              Operational utilities
|   `-- tests/                Backend tests
|-- frontend/
|   |-- public/
|   `-- src/
|       |-- components/       Shared UI and layout components
|       |-- pages/            Application pages
|       |-- services/         API clients
|       |-- store/            Authentication and UI state
|       `-- types/            TypeScript models
|-- doc/                      Project document and PlantUML source files
|-- docs/                     Engineering and pilot documentation
|-- ActivityDiagram/          Activity diagram sources and exports
|-- docker-compose.yml
|-- .env.example
`-- README.md
```

## ความต้องการของระบบ

- Git
- Python 3.11
- Node.js 20 และ npm
- PostgreSQL 15 หรือ Docker Desktop
- พื้นที่จัดเก็บสำหรับไฟล์อัปโหลดและหลักฐาน
- กล้อง USB หรือ RTSP เมื่อต้องการใช้การตรวจจับแบบกล้อง
- NVIDIA GPU และ CUDA เป็นตัวเลือก ไม่ใช่ข้อบังคับ

Docker และ CI ของโครงการตรวจสอบกับ Python 3.11 และ Node.js 20 จึงแนะนำให้ใช้เวอร์ชันดังกล่าว

## การตั้งค่าสภาพแวดล้อม

ไฟล์ตัวอย่างอยู่ที่ `.env.example` มีหลักการใช้งานดังนี้:

- การรันด้วย Docker Compose ใช้ไฟล์ `.env` ที่ root ของ repository
- การรัน Backend แบบ native จากโฟลเดอร์ `backend` ใช้ไฟล์ `backend/.env`
- ค่า `VITE_API_URL` ของ Frontend ควรอยู่ใน `frontend/.env.local`
- ห้าม commit ไฟล์ `.env`, รหัสผ่าน, JWT secret, SMTP password หรือ RTSP credential

### ค่าระบบและฐานข้อมูล

| ตัวแปร                    | ค่าเริ่มต้นหรือตัวอย่าง  | รายละเอียด                                                                                                    |
| ------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `ENVIRONMENT`                 | `development`                                 | ใช้`production` สำหรับระบบจริง                                                                       |
| `DEBUG`                       | `true`                                        | ปิดใน production                                                                                                   |
| `SECRET_KEY`                  | ต้องเปลี่ยน                          | Secret สำหรับลงนาม JWT ต้องไม่ซ้ำและยาวอย่างน้อย 32 ตัวอักษรใน production |
| `ALLOWED_ORIGINS`             | `http://localhost:3000,http://localhost:5173` | Origin ที่อนุญาตให้เรียก API                                                                           |
| `DATABASE_URL`                | PostgreSQL URL                                  | การรัน native ใช้ host`localhost`; Compose ใช้ host `db`                                                |
| `POSTGRES_USER`               | `postgres`                                    | ผู้ใช้ PostgreSQL สำหรับ Compose                                                                            |
| `POSTGRES_PASSWORD`           | ต้องเปลี่ยน                          | รหัสผ่าน PostgreSQL สำหรับ Compose                                                                        |
| `POSTGRES_DB`                 | `ppe_detection`                               | ชื่อฐานข้อมูล                                                                                              |
| `AUTO_CREATE_TABLES`          | `true` ในตัวอย่าง                   | ใช้เฉพาะ development; production ต้องเป็น`false` และใช้ Alembic                                 |
| `API_V1_PREFIX`               | `/api/v1`                                     | Prefix ของ API                                                                                                       |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60`                                          | อายุ JWT หน่วยนาที                                                                                         |
| `ALGORITHM`                   | `HS256`                                       | อัลกอริทึม JWT                                                                                                |

### การสร้าง Administrator เริ่มต้น

| ตัวแปร                  | รายละเอียด                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `BOOTSTRAP_ADMIN_EMAIL`     | อีเมล Administrator คนแรก                                                                                     |
| `BOOTSTRAP_ADMIN_PASSWORD`  | รหัสผ่านเริ่มต้น ควรลบออกจาก environment หลังสร้างบัญชีสำเร็จ            |
| `BOOTSTRAP_TOKEN`           | Token สำหรับกลไก bootstrap แบบเดิม ไม่ควรใช้แทน startup provisioning                       |
| `ALLOW_PUBLIC_REGISTRATION` | ค่าเริ่มต้น`false`; เมื่อเปิด การสมัครสาธารณะจะสร้างได้เฉพาะ Viewer |

ระบบจะสร้าง Administrator ตอนเริ่ม Backend เมื่อกำหนดทั้ง `BOOTSTRAP_ADMIN_EMAIL` และ `BOOTSTRAP_ADMIN_PASSWORD` เท่านั้น หลังเข้าสู่ระบบได้แล้วให้ลบ `BOOTSTRAP_ADMIN_PASSWORD` ออกจาก environment และ restart service

### โมเดลและ Inference

| ตัวแปร                    | ค่าเริ่มต้น             | รายละเอียด                                                                     |
| ------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| `MODEL_PATH`                  | `./yolo8m.pt`                    | โมเดลหลักสำหรับ PPE                                                       |
| `PERSON_MODEL_PATH`           | `./yolo11n.pt`                   | โมเดลช่วยตรวจจับบุคคล                                               |
| `MODEL_VERSION`               | `sh17-yolov8m-yolo11n-hybrid-v1` | ชื่อเวอร์ชันที่บันทึกกับผลตรวจจับ                       |
| `MODEL_LICENSE_APPROVED`      | `false`                          | ยืนยันว่าผ่านการตรวจสิทธิ์โมเดลและข้อมูลแล้ว |
| `CONFIDENCE_THRESHOLD`        | `0.20`                           | Threshold ของโมเดล PPE                                                           |
| `PERSON_CONFIDENCE_THRESHOLD` | `0.30`                           | Threshold ของโมเดลบุคคล                                                     |
| `INFERENCE_DEVICE`            | `auto`                           | เลือก CUDA เมื่อพร้อม มิฉะนั้นใช้ CPU                          |
| `INFERENCE_IMAGE_SIZE`        | `640`                            | ขนาดภาพสำหรับ inference                                                     |
| `LOW_LIGHT_ENHANCEMENT`       | `true`                           | ปรับภาพเมื่อแสงน้อย                                                   |
| `LOW_LIGHT_LUMA_THRESHOLD`    | `72`                             | ค่าเฉลี่ยความสว่างที่เริ่มปรับภาพ                       |
| `PPE_CROP_REFINEMENT`         | `true`                           | ตรวจ PPE ซ้ำใน crop ของบุคคล                                            |
| `PPE_CROP_MAX_PERSONS`        | `8`                              | จำนวนบุคคลสูงสุดที่ refinement ต่อเฟรม                         |

Production จะไม่เริ่มทำงานหาก `MODEL_LICENSE_APPROVED=false` การเปลี่ยนเป็น `true` ต้องทำหลังตรวจสอบสิทธิ์ชุดข้อมูล โมเดล และเงื่อนไขเชิงพาณิชย์จริงแล้วเท่านั้น

### กล้องและการยืนยันเหตุการณ์

| ตัวแปร                     | ค่าเริ่มต้น | รายละเอียด                                                       |
| -------------------------------- | ---------------------- | -------------------------------------------------------------------------- |
| `CAMERA_ANALYSIS_FPS`          | `15`                 | เป้าหมายเฟรมต่อวินาทีสำหรับวิเคราะห์   |
| `CAMERA_PREVIEW_FPS`           | `15`                 | เป้าหมายเฟรมต่อวินาทีสำหรับ Preview             |
| `CAMERA_CAPTURE_WIDTH`         | `1280`               | ความกว้างภาพจากกล้อง                                   |
| `CAMERA_CAPTURE_HEIGHT`        | `720`                | ความสูงภาพจากกล้อง                                       |
| `CAMERA_CAPTURE_FPS`           | `30`                 | FPS ที่ขอจากอุปกรณ์                                         |
| `CAMERA_CAPTURE_BUFFER_SIZE`   | `1`                  | ขนาด capture buffer                                                    |
| `CAMERA_RECONNECT_MAX_SECONDS` | `30`                 | เวลารอ reconnect สูงสุด                                        |
| `TEMPORAL_WINDOW_SIZE`         | `5`                  | จำนวนเฟรมในหน้าต่างยืนยัน                         |
| `TEMPORAL_CONFIRM_COUNT`       | `4`                  | จำนวนเฟรมผิดกฎที่ใช้ยืนยันเหตุการณ์     |
| `TEMPORAL_CLEAR_COUNT`         | `3`                  | จำนวนเฟรมปกติต่อเนื่องที่ใช้ล้างสถานะ |
| `EVENT_COOLDOWN_SECONDS`       | `60`                 | ช่วงพักก่อนสร้างเหตุการณ์ซ้ำ                   |

### Upload, Video และ Evidence

| ตัวแปร                  | ค่าเริ่มต้น | รายละเอียด                                                                                                         |
| ----------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `UPLOAD_DIR`                | `./uploads`          | ที่เก็บไฟล์ต้นฉบับและผลลัพธ์                                                                     |
| `EVIDENCE_DIR`              | `./uploads/evidence` | ที่เก็บ Snapshot และคลิปเหตุการณ์                                                                     |
| `MAX_FILE_SIZE`             | `104857600`          | ขนาดไฟล์สูงสุด 100 MB                                                                                          |
| `MAX_FRAME_SIZE`            | `10485760`           | ขนาดเฟรมสูงสุด 10 MB                                                                                           |
| `VIDEO_FRAME_STRIDE`        | `5`                  | วิเคราะห์ทุก 5 เฟรมของวิดีโอ                                                                        |
| `VIDEO_MAX_ANALYZED_FRAMES` | `600`                | จำนวนเฟรมที่วิเคราะห์สูงสุดต่อวิดีโอ                                                     |
| `EVIDENCE_PRE_SECONDS`      | `5`                  | ช่วงเวลาก่อนเหตุการณ์ในคลิป                                                                       |
| `EVIDENCE_POST_SECONDS`     | `10`                 | ช่วงเวลาหลังเหตุการณ์ในคลิป                                                                       |
| `EVIDENCE_RETENTION_DAYS`   | `30`                 | อายุไฟล์หลักฐานก่อน cleanup                                                                               |
| `METADATA_RETENTION_DAYS`   | `365`                | ค่าที่เตรียมไว้สำหรับ metadata แต่ยังไม่ได้บังคับใช้กับแถวฐานข้อมูล |

### SMTP

| ตัวแปร         | ค่าเริ่มต้น | รายละเอียด                                     |
| -------------------- | ---------------------- | -------------------------------------------------------- |
| `SMTP_HOST`        | ว่าง               | ปล่อยว่างเพื่อปิดการส่งอีเมล |
| `SMTP_PORT`        | `587`                | SMTP port                                                |
| `SMTP_USERNAME`    | ว่าง               | ชื่อผู้ใช้ SMTP                                |
| `SMTP_PASSWORD`    | ว่าง               | รหัสผ่าน SMTP                                    |
| `SMTP_FROM_EMAIL`  | ว่าง               | อีเมลผู้ส่ง                                   |
| `SMTP_USE_TLS`     | `true`               | เปิด TLS                                             |
| `ALERT_RECIPIENTS` | ว่าง               | รายชื่อผู้รับ คั่นด้วย comma        |

## ติดตั้งและรันแบบ Native บน Windows

### 1. เตรียม PostgreSQL

สร้างฐานข้อมูลชื่อ `ppe_detection` หรือใช้ชื่ออื่นแล้วแก้ `DATABASE_URL` ให้ตรงกัน PostgreSQL ต้องพร้อมรับ connection ก่อนเริ่ม Backend

### 2. ติดตั้ง Backend

```powershell
cd backend
Copy-Item ..\.env.example .env
```

แก้ `backend/.env` อย่างน้อยดังนี้:

```dotenv
DATABASE_URL=postgresql://postgres:<database-password>@localhost:5432/ppe_detection
SECRET_KEY=<random-secret-at-least-32-characters>
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=<strong-initial-password>
```

จากนั้นติดตั้ง dependency และ migration:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m alembic upgrade head
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
								or
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

สำหรับ Windows ที่ใช้ NVIDIA และ CUDA 12.8:

```powershell
python -m pip install -r requirements-gpu.txt
python -c "import torch; print(torch.cuda.is_available())"
```

หากไม่มี GPU ระบบจะใช้ CPU และปิด person-crop refinement อัตโนมัติเพื่อลด latency

### 3. ติดตั้ง Frontend

เปิด PowerShell อีกหน้าต่าง:

```powershell
cd frontend
npm ci
npm run dev
```

สร้าง `frontend/.env.local` ด้วยค่า:

```dotenv
VITE_API_URL=http://localhost:8000/api/v1
```

`VITE_API_URL` ถูกฝังตอน build และไม่ควรเก็บข้อมูลลับ หากไม่กำหนด Frontend จะใช้ hostname เดียวกับหน้าเว็บและ port `8000`

### 4. เปิดระบบ

- Frontend development: `http://localhost:5173`
- Backend: `http://localhost:8000`
- OpenAPI development: `http://localhost:8000/docs`
- ReDoc development: `http://localhost:8000/redoc`
- Liveness: `http://localhost:8000/health`
- Database readiness: `http://localhost:8000/ready`
- Prometheus metrics: `http://localhost:8000/metrics`

OpenAPI และ ReDoc ถูกปิดเมื่อใช้ `ENVIRONMENT=production`

## รันด้วย Docker Compose

```powershell
Copy-Item .env.example .env
```

แก้ placeholder ทั้งหมดใน `.env` โดยเฉพาะ `POSTGRES_PASSWORD`, `SECRET_KEY`, CORS origin และบัญชี Administrator จากนั้นรัน:

```powershell
docker compose up --build
```

URL เมื่อใช้ Compose:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- PostgreSQL: `localhost:5432`

พฤติกรรมของ Compose:

- รอ PostgreSQL ผ่าน health check ก่อนเริ่ม Backend
- บังคับ `AUTO_CREATE_TABLES=false`
- รัน `alembic upgrade head` ก่อนเริ่ม Uvicorn
- เก็บ PostgreSQL ใน volume `postgres_data`
- เก็บ Upload และ Evidence ใน volume `uploads_data`
- Backend image มาตรฐานติดตั้ง dependency สำหรับ CPU และไม่ได้ตั้งค่า NVIDIA runtime

ไฟล์ `.env.example` ใช้ `ENVIRONMENT=development` หากนำไปใช้กับ production ต้องเปลี่ยนเป็น `production`, ปิด `DEBUG`, ใช้ secret จริง และดำเนินการตรวจสิทธิ์โมเดลก่อนตั้ง `MODEL_LICENSE_APPROVED=true`

สำหรับกล้อง USB แนะนำให้รัน Backend แบบ native บนเครื่อง เพราะ USB passthrough ของ Docker Desktop แตกต่างกันตามระบบปฏิบัติการ

## การใช้งานระบบ

### Administrator

1. เข้าสู่ระบบด้วยบัญชีที่สร้างจาก Bootstrap
2. เปิด `/admin/users` เพื่อสร้างบัญชีและกำหนด Role
3. เปิด `/detect` เพื่อค้นหาและลงทะเบียนกล้อง
4. กำหนด Zone และ PPE ที่ต้องใช้ผ่าน API หรือหน้าจอที่รองรับ
5. ทดสอบกล้องก่อน Start
6. ตรวจสอบ `/reports` หรือ `/alerts` สำหรับผลตรวจจับและหลักฐาน

### Safety Officer

1. เปิด `/detect` เพื่อดู Preview และควบคุมกล้องที่ Administrator ลงทะเบียนไว้
2. ตรวจสอบ Alert และรายละเอียดหลักฐานใน `/alerts`
3. ใช้ Acknowledge เมื่อรับทราบเหตุการณ์
4. ใช้ Resolve เมื่อจัดการเหตุการณ์เสร็จ
5. ปรับค่าการตรวจจับของบัญชีตนเองที่ `/settings`

### Viewer

1. เปิด Dashboard เพื่อดูสถิติ กราฟ เหตุการณ์ล่าสุด และจำนวนกล้องออนไลน์
2. เปิด Reports & Alerts เพื่อดูประวัติ รายละเอียด และหลักฐานส่วนกลาง
3. ส่งออกรายงาน PDF ได้
4. ไม่สามารถเปลี่ยนข้อมูล ควบคุมกล้อง หรือเปลี่ยนสถานะเหตุการณ์

## รูปแบบไฟล์ที่รองรับ

รูปภาพ:

- `.jpg`
- `.jpeg`
- `.png`
- `.webp`

วิดีโอ:

- `.mp4`
- `.avi`
- `.mov`
- `.webm`
- `.mkv`

ไฟล์ทั่วไปมีขนาดสูงสุด 100 MB และ Frame endpoint รองรับ payload สูงสุด 10 MB ตามค่าเริ่มต้น

## API หลัก

Prefix เริ่มต้นคือ `/api/v1`

### Endpoint สาธารณะ

| Method  | Endpoint     | รายละเอียด                    |
| ------- | ------------ | --------------------------------------- |
| `GET` | `/`        | ข้อมูลพื้นฐานของ API    |
| `GET` | `/health`  | ตรวจว่า process ยังทำงาน |
| `GET` | `/ready`   | ตรวจ connection ฐานข้อมูล  |
| `GET` | `/metrics` | Metrics รูปแบบ Prometheus         |

### Authentication

| Method   | Endpoint                                 | รายละเอียด                                       |
| -------- | ---------------------------------------- | ---------------------------------------------------------- |
| `POST` | `/api/v1/auth/login`                   | เข้าสู่ระบบด้วย OAuth2 form                 |
| `POST` | `/api/v1/auth/register`                | สมัคร Viewer เมื่อเปิด public registration   |
| `GET`  | `/api/v1/auth/me`                      | อ่านข้อมูลผู้ใช้ปัจจุบัน           |
| `POST` | `/api/v1/auth/forgot-password`         | ขอรหัสรีเซ็ตรหัสผ่าน                   |
| `POST` | `/api/v1/auth/forgot-password/confirm` | ยืนยันรหัสและตั้งรหัสผ่านใหม่ |

ไม่ควรใช้ endpoint bootstrap แบบเดิมสำหรับติดตั้งใหม่ ให้ใช้ `BOOTSTRAP_ADMIN_EMAIL` และ `BOOTSTRAP_ADMIN_PASSWORD` ตอน startup แทน

### Detection

| Method   | Endpoint                                | สิทธิ์     | รายละเอียด                                                        |
| -------- | --------------------------------------- | ---------------- | --------------------------------------------------------------------------- |
| `POST` | `/api/v1/detection/image`             | Safety, Admin    | ตรวจจับจากรูปและบันทึกผล                            |
| `POST` | `/api/v1/detection/video`             | Safety, Admin    | ตรวจจับจากวิดีโอและบันทึกผล                      |
| `POST` | `/api/v1/detection/frame`             | Safety, Admin    | ตรวจจับเฟรมในหน่วยความจำ ไม่บันทึก History |
| `GET`  | `/api/v1/detection/history`           | ทุกบทบาท | อ่านประวัติส่วนกลาง                                      |
| `GET`  | `/api/v1/detection/stats`             | ทุกบทบาท | อ่านสถิติรวม                                                    |
| `GET`  | `/api/v1/detection/analytics/daily`   | ทุกบทบาท | อ่านสถิติรายวัน                                              |
| `GET`  | `/api/v1/detection/{id}`              | ทุกบทบาท | อ่านรายละเอียดผลตรวจจับ                              |
| `GET`  | `/api/v1/detection/{id}/image/result` | ทุกบทบาท | อ่านรูปผลลัพธ์แบบ protected                                |
| `GET`  | `/api/v1/detection/{id}/video/result` | ทุกบทบาท | อ่านวิดีโอผลลัพธ์แบบ protected                          |

### Cameras

กลุ่ม `/api/v1/cameras` รองรับ:

- อ่านรายการ รายละเอียด และสถานะกล้องสำหรับผู้ใช้ที่เข้าสู่ระบบ
- ค้นหาอุปกรณ์ USB สำหรับ Administrator
- ลงทะเบียน แก้ไข และลบกล้องสำหรับ Administrator
- Test, Start และ Stop สำหรับ Safety Officer และ Administrator
- อ่าน Preview JPEG และ MJPEG stream สำหรับ Safety Officer และ Administrator

ชนิดแหล่งข้อมูลที่ schema รองรับคือ `usb`, `rtsp` และ `file` โดย USB index รองรับ `0` ถึง `32` และการค้นหาอัตโนมัติตรวจ index `0` ถึง `10`

### Alerts และ Events

| กลุ่ม         | ความสามารถ                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `/api/v1/alerts` | อ่านรายการส่วนกลาง และให้ Safety/Admin Acknowledge หรือ Resolve                                      |
| `/api/v1/events` | อ่านรายการและรายละเอียด ดาวน์โหลด Snapshot/Clip และเปลี่ยนสถานะตามสิทธิ์ |

เมื่อ Alert เชื่อมกับ Event การเปลี่ยนสถานะจะพยายามปรับข้อมูลที่เกี่ยวข้องให้สอดคล้องกัน

### Zones, Settings, Models และ Admin

| กลุ่ม                | รายละเอียด                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `/api/v1/zones`         | อ่านโซน และให้ Administrator สร้าง แก้ไข หรือปิดใช้งาน |
| `/api/v1/settings/me`   | อ่านค่าของตนเอง และให้ Safety/Admin แก้ไข                        |
| `/api/v1/models/active` | อ่านข้อมูลโมเดลและค่า temporal ที่กำลังใช้งาน           |
| `/api/v1/admin/users`   | ให้ Administrator อ่าน สร้าง และแก้ผู้ใช้                          |

Zone รองรับ PPE rule เฉพาะ `helmet` และ `safety-vest` ระดับความเสี่ยงคือ `low`, `medium`, `high` และ `critical`

### WebSocket

```text
ws://localhost:8000/api/v1/ws/events?room=alerts&token=<JWT>
ws://localhost:8000/api/v1/ws/events?room=cameras&token=<JWT>
```

Room ที่รองรับคือ `alerts`, `detections` และ `cameras` ปัจจุบันระบบส่ง shared broadcast หลักในห้อง Alerts และ Cameras ส่วนห้อง Detections มี route รองรับแต่ service ปัจจุบันยังไม่ได้ broadcast โดยตรง

JWT ใน query string อาจถูกบันทึกโดย proxy หรือ access log ควรใช้ HTTPS/WSS ปิดการบันทึก query string และวางระบบหลัง reverse proxy ที่ตั้งค่าอย่างเหมาะสม

## การตรวจจับและโมเดล

โมเดลเริ่มต้น:

- `backend/yolo8m.pt` เป็นโมเดลหลักของ SH17 สำหรับ PPE
- `backend/yolo8s.pt` เป็น PPE fallback
- `backend/yolo11n.pt` ช่วยตรวจจับบุคคล
- `backend/yolov8n.pt` อยู่ใน repository แต่ runtime ปัจจุบันไม่ได้เลือกเป็นค่าเริ่มต้น

โมเดล PPE ต้องมี class `person`, `helmet` และ `safety-vest` หากโมเดลที่ใช้อยู่ไม่มี class ที่จำเป็น ระบบจะคืนผลสถานะ error แทนการรายงานว่าตรวจไม่พบอย่างปกติ

รายละเอียดการประมวลผล:

- `INFERENCE_DEVICE=auto` เลือก CUDA device `0` เมื่อพร้อม มิฉะนั้นใช้ CPU
- Person-crop refinement ปิดอัตโนมัติเมื่อใช้ CPU
- Low-light enhancement ทำงานเมื่อค่าเฉลี่ย luma ต่ำกว่า threshold
- กฎ PPE ของ Zone มีลำดับความสำคัญเหนือ preference ของผู้ใช้
- หากไม่มี Zone rule ระบบใช้ Helmet/Vest rule จาก User Settings
- การตั้งค่าที่ Camera runtime ใช้เป็นค่าของเจ้าของกล้อง ไม่ใช่ผู้ที่กด Start
- Polygon ของ Zone รองรับทั้ง normalized coordinate และ pixel coordinate
- ระบบเลือกบุคคลเข้า Zone จากจุดกึ่งกลางด้านล่างของ bounding box
- วิดีโอวิเคราะห์ตาม frame stride และจำกัดจำนวนเฟรมที่วิเคราะห์
- หาก OpenCV ไม่มี encoder ที่รองรับ ระบบอาจคืนภาพ JPEG ของเฟรมที่ดีที่สุดแทนไฟล์วิดีโอผลลัพธ์

## กล้อง เหตุการณ์ และหลักฐาน

- กล้องที่มีสถานะ active จะพยายามกลับมาทำงานเมื่อ Backend เริ่มใหม่
- การ inference ของกล้องถูก serialize ผ่าน asynchronous lock เดียว
- การ reconnect ใช้ exponential backoff สูงสุด 30 วินาทีตามค่าเริ่มต้น
- ค่าเริ่มต้นยืนยันการฝ่าฝืนเมื่อพบ 4 จาก 5 เฟรม
- สถานะผิดกฎถูกล้างเมื่อพบเฟรมที่ถูกต้องต่อเนื่อง 3 เฟรม
- เหตุการณ์ซ้ำมี cooldown 60 วินาที
- ระบบไม่บันทึกวิดีโอกล้องต่อเนื่อง
- Ring buffer ในหน่วยความจำเก็บ JPEG สำหรับช่วงก่อนเกิดเหตุการณ์
- Snapshot และคลิปจากกล้องถูกเบลอบริเวณศีรษะแบบ best effort ก่อนเขียนไฟล์
- ค่าเริ่มต้นของคลิปคือ 5 วินาทีก่อนและ 10 วินาทีหลังเหตุการณ์
- Live Preview ไม่ถูกเบลอ อยู่ในหน่วยความจำ จำกัดเฉพาะ Safety/Admin และส่ง header ป้องกัน cache
- Preview JPEG จำกัดความกว้างสูงสุด 960 พิกเซล
- อีเมลของเหตุการณ์จากกล้อง retry สูงสุด 3 ครั้ง
- Alert จากการอัปโหลดไฟล์ถูก broadcast แต่ไม่ได้ผ่าน workflow ส่งอีเมลของกล้อง

การเบลอเป็นเพียงมาตรการลดความเสี่ยง ไม่ใช่การ anonymize ที่รับประกันผล และไม่ได้ครอบคลุมไฟล์ต้นฉบับที่ผู้ใช้อัปโหลด ระบบไม่มีการจดจำใบหน้าและไม่มีการระบุตัวบุคคล

## ฐานข้อมูล

ตารางหลักที่ใช้งาน:

| ตาราง           | หน้าที่                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `users`            | ผู้ใช้ Role สถานะบัญชี และข้อมูลเข้าสู่ระบบ           |
| `user_settings`    | ค่าการตรวจจับและการแจ้งเตือนรายบัญชี                  |
| `zones`            | พื้นที่ตรวจจับ Polygon, risk level และ PPE ที่จำเป็น            |
| `cameras`          | แหล่งสัญญาณ เจ้าของ สถานะ และข้อมูลสุขภาพกล้อง |
| `detections`       | งานตรวจจับ ผลรวม บุคคล การฝ่าฝืน และ path ของ media    |
| `violation_logs`   | เหตุการณ์ฝ่าฝืนจากกล้องและหลักฐาน                        |
| `alerts`           | ข้อความแจ้งเตือนและสถานะการดำเนินการ                  |
| `alert_deliveries` | ประวัติการส่ง Alert ไปยังช่องทางต่าง ๆ                      |
| `safety_rules`     | โมเดลกฎความปลอดภัยที่เตรียมไว้ในระบบ                  |
| `daily_stats`      | โมเดลสถิติรายวันที่เตรียมไว้ในระบบ                      |

Migration ปัจจุบันใช้ Alembic ให้รัน:

```powershell
cd backend
python -m alembic upgrade head
```

ไม่ควรใช้ `AUTO_CREATE_TABLES=true` ใน production เพราะ production validation จะปฏิเสธค่า ดังกล่าว และ migration เป็นแหล่งอ้างอิง schema ที่เหมาะสมกว่า

## การเก็บรักษาข้อมูล

- งาน cleanup ทำงานทุก 24 ชั่วโมง
- ลบไฟล์ Evidence และ Upload ที่เก่ากว่า `EVIDENCE_RETENTION_DAYS`
- ลบเฉพาะไฟล์ที่ resolve แล้วอยู่ภายใต้ root ที่ตั้งค่าไว้
- เมื่อไฟล์หมดอายุ path ที่เกี่ยวข้องจะถูกล้างหรือทำเครื่องหมายว่า expired
- แถว Detection และ Event ยังอยู่ในฐานข้อมูล
- `METADATA_RETENTION_DAYS` มีใน configuration แต่ยังไม่มีงานลบ metadata row ตามค่านี้

ให้สำรองฐานข้อมูล PostgreSQL และ upload volume พร้อมกัน เพื่อป้องกัน metadata และไฟล์หลักฐานไม่ตรงกันหลัง restore

## การทดสอบ

### Backend

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q
```

ชุดทดสอบครอบคลุม Authentication, RBAC, Admin Users, Camera runtime, Detection, Alerts, Evidence privacy, Retention, Temporal tracking และเครื่องมือประเมินโมเดล

### Frontend

```powershell
cd frontend
npm ci
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

Frontend ยังไม่มีชุด Unit, Component หรือ End-to-End test แยกต่างหาก จึงควรทำ browser smoke test ด้วยบัญชี Viewer, Safety Officer และ Administrator ก่อน deploy

CI ใช้ Python 3.11 และ Node.js 20

## การฝึกและประเมินโมเดล

ก่อนฝึกโมเดล ให้เตรียม dataset configuration ตามเอกสารใน `backend/mlops/README.md` และเก็บข้อมูลเฉพาะที่ได้รับอนุมัติแล้ว

```powershell
cd backend
Copy-Item mlops\ppe_factory.example.yaml mlops\ppe_factory.yaml
python -m app.ml.train_ppe --data mlops/ppe_factory.yaml --model yolo8s.pt --name factory-yolo8s-v1
python -m app.ml.evaluate_ppe --data mlops/ppe_factory.yaml --model experiments/factory-yolo8s-v1/weights/best.pt --split test --output experiments/factory-yolo8s-v1/test_metrics.json
python -m app.ml.evaluate_events --ground-truth <approved.csv> --predictions <reviewed.csv> --camera-hours 32 --output <report.json> --require-pass
```

CSV ใช้ในเครื่องมือประเมิน Event ของฝ่าย ML เท่านั้น หน้าเว็บปัจจุบันส่งออกรายงานเป็น PDF

ห้ามอ้างความแม่นยำระดับ production จากค่า training เพียงอย่างเดียว และห้ามสุ่มเฟรมติดกันจากวิดีโอเดียวกันไปอยู่ทั้ง train และ test เพราะทำให้ผลประเมินสูงเกินจริง

เป้าหมาย Acceptance ของ pilot เป็นเกณฑ์สำหรับการทดสอบ ไม่ใช่ผลที่รับประกัน:

- Recall อย่างน้อย 90 เปอร์เซ็นต์
- Precision อย่างน้อย 85 เปอร์เซ็นต์
- False alert ไม่เกิน 1 ครั้งต่อกล้องต่อชั่วโมง
- รองรับ 4 กล้องที่ analyzed FPS อย่างน้อย 5
- p95 alert latency ไม่เกิน 3 วินาที
- Reconnect ภายใน 30 วินาที
- Soak test ต่อเนื่อง 8 ชั่วโมง

ตัวอย่างการติดตาม Soak test:

```powershell
$env:PPE_API_TOKEN = "<admin-or-safety-officer-jwt>"
python scripts/pilot_monitor.py --hours 8 --interval 30 --minimum-fps 5 --expected-cameras 4 --output pilot-soak.csv
```

## Health check และการปฏิบัติการ

| Endpoint     | ตรวจสอบอะไร                                                                      |
| ------------ | ------------------------------------------------------------------------------------------- |
| `/health`  | Process ของ API ตอบสนอง                                                           |
| `/ready`   | เชื่อมต่อฐานข้อมูลด้วย`SELECT 1` ได้                             |
| `/metrics` | สถิติกล้อง เหตุการณ์ FPS และตัวชี้วัดรูปแบบ Prometheus |

`/ready` ไม่ได้ตรวจโมเดล กล้อง พื้นที่ดิสก์ SMTP หรือ GPU ข้อความสถานะ AI และ Backend บางตำแหน่งใน UI เป็น presentation state ไม่ใช่ health probe จริง ให้ใช้ endpoint และระบบ monitoring สำหรับการตรวจความพร้อม

## ความปลอดภัยและความเป็นส่วนตัว

- ใช้ HTTPS และ WSS เมื่อนำไปใช้นอกเครื่องพัฒนา
- วาง Backend หลัง reverse proxy และจำกัดการเข้าถึง PostgreSQL, Metrics และ Camera stream
- ปิดการบันทึก query string เนื่องจาก WebSocket และ MJPEG stream ปัจจุบันส่ง JWT ผ่าน URL
- เปลี่ยน `SECRET_KEY`, รหัสผ่านฐานข้อมูล และบัญชี Bootstrap ก่อน deploy
- ลบ Bootstrap password หลังสร้าง Administrator สำเร็จ
- ห้าม commit `.env`, SMTP credential หรือ URL RTSP ที่มีรหัสผ่าน
- RTSP credential ถูกซ่อนจาก API response แต่ยังเก็บใน Database URL โดยไม่มี application-level encryption
- JWT ของ Frontend เก็บใน browser local storage จึงต้องลดความเสี่ยง XSS และกำหนดอายุ token ให้เหมาะสม
- `/metrics` ยังไม่บังคับ Login และอาจเปิดเผยชื่อกล้อง สถานะ และ FPS ต้องป้องกันด้วย network policy หรือ reverse proxy
- Viewer อ่านข้อมูลส่วนกลางทั้งหมด ระบบยังไม่มี tenant หรือ site isolation
- Protected media endpoint อาศัย path ที่เก็บในฐานข้อมูล จึงต้องจำกัดสิทธิ์ฐานข้อมูลและตรวจสอบ storage อย่างเคร่งครัด
- Development password reset อาจพิมพ์รหัสลง server log ห้ามใช้พฤติกรรมนี้ใน production
- การลด Role หรือปิดบัญชีระหว่างเปิด Preview/WebSocket อาจไม่ตัด connection ที่เปิดอยู่ทันที ควรบังคับ reconnect หลังเปลี่ยนสิทธิ์
- ระบบป้องกัน Administrator ปิดบัญชีตนเองในบางเส้นทาง แต่ยังต้องเพิ่มการป้องกันการลด Role ตนเองและการลดจำนวน Administrator จนไม่เหลือผู้ดูแล
- ยังไม่มี SSO/OIDC, audit log สำหรับทุกคำสั่งผู้ดูแล, external penetration test, high availability หรือการรับรอง PDPA อย่างเป็นทางการ

ก่อนใช้งานจริง ให้ตรวจสอบ `backend/.dockerignore` และ build context เพื่อป้องกันไฟล์ local เช่น `backend/.env` ถูกคัดลอกเข้า container image

## ข้อจำกัดของระบบปัจจุบัน

- เป็นระบบต้นแบบสำหรับการศึกษาและ pilot ไม่ใช่ระบบ safety-critical ที่ผ่านการรับรอง
- ไม่รับประกันว่าจะตรวจพบการฝ่าฝืนทุกครั้ง และอาจเกิด false positive หรือ false negative
- ไม่ทำ Face Recognition ไม่ระบุตัวพนักงาน และไม่ควรใช้ตัดสินโทษอัตโนมัติ
- Runtime แบบ in-process ไม่เหมาะกับการรัน Backend หลาย replica โดยไม่มี shared coordination
- Inference ของกล้องใช้ lock เดียว จึงต้องทดสอบ throughput กับ hardware และจำนวนกล้องจริง
- Docker image มาตรฐานยังไม่มี GPU runtime path
- RTSP ต้องทดสอบกับกล้องและ network ของพื้นที่ติดตั้งจริง
- Backend test ใช้ SQLite ชั่วคราว จึงยังไม่ครอบคลุมความแตกต่างเฉพาะของ PostgreSQL ทั้งหมด
- Frontend ยังไม่มี Event list แยกจาก Alert
- หน้า Camera และ Zone สำหรับ Administrator ยังไม่ครอบคลุม CRUD ทุกคำสั่งที่ Backend รองรับ
- Metadata retention ยังไม่ถูกบังคับใช้
- Live Preview ไม่มีการเบลอและต้องจำกัดผู้เข้าถึงอย่างเข้มงวด
- Privacy blur เป็น best effort และไม่ใช่การรับรองการ anonymize

## การแก้ปัญหาเบื้องต้น

### Backend เชื่อมต่อฐานข้อมูลไม่ได้

- เมื่อรัน native ให้ใช้ `localhost` ใน `DATABASE_URL`
- เมื่อรัน Compose ให้ใช้ service name `db`
- ตรวจว่า PostgreSQL พร้อมและ database, user, password ตรงกับ environment
- รัน `python -m alembic upgrade head`

### เข้าหน้าเว็บได้แต่ API ตอบ CORS error

- เพิ่ม URL ของ Frontend ใน `ALLOWED_ORIGINS`
- ระบุ scheme, hostname และ port ให้ตรงกับ URL จริง
- Restart Backend หลังเปลี่ยน environment

### กล้อง USB ไม่ปรากฏ

- ปิดโปรแกรมอื่นที่ใช้งานกล้องอยู่
- อนุญาต Camera permission ให้ Terminal, PowerShell, VS Code หรือ Python
- รัน Backend บน host แทน Docker Desktop
- ตรวจ USB index และทดสอบกล้องจากหน้า Detect ด้วยบัญชีที่มีสิทธิ์

### ระบบใช้ CPU แทน GPU

```powershell
cd backend
.\.venv\Scripts\python.exe -c "import torch; print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU')"
```

ตรวจว่าได้ติดตั้ง `requirements-gpu.txt`, driver และ CUDA runtime ที่เข้ากันได้

### Viewer เปิด Dashboard แล้วไม่เห็นข้อมูล

- ตรวจว่า Login สำเร็จและบัญชียัง active
- ตรวจ `GET /api/v1/auth/me`
- ตรวจว่า Backend และฐานข้อมูลพร้อมผ่าน `/ready`
- ตรวจ request ของ Stats, Analytics, History และ Alerts ใน Browser DevTools
- Viewer อ่านข้อมูลส่วนกลางได้ แต่ฐานข้อมูลใหม่อาจยังไม่มีรายการตรวจจับ

### Frontend build บน Windows แจ้ง EPERM

- หยุด Vite preview หรือ process ที่เปิดไฟล์ใน `dist`
- ปิดหน้าต่าง File Explorer ที่กำลัง Preview ไฟล์ในโฟลเดอร์ดังกล่าว
- รัน `npm run build` ใหม่

### ไม่ได้รับอีเมลแจ้งเตือน

- ตรวจ `SMTP_HOST`, `SMTP_FROM_EMAIL` และ `ALERT_RECIPIENTS`
- ตรวจ TLS, port, username และ password
- ตรวจ Backend log สำหรับผล retry
- Alert จากไฟล์อัปโหลดยังไม่ใช้ Camera email-delivery workflow

## เอกสารที่เกี่ยวข้อง

- [คู่มือปฏิบัติการ Pilot](docs/pilot/OPERATIONS_RUNBOOK.md)
- [ขั้นตอน Acceptance Test](docs/pilot/ACCEPTANCE_TEST_PROTOCOL.md)
- [รายการตรวจสอบการอนุมัติข้อมูล](docs/pilot/DATA_APPROVAL_CHECKLIST.md)
- [Commercialization Gate](docs/pilot/COMMERCIALIZATION_GATE.md)
- [คู่มือ MLOps และ Dataset](backend/mlops/README.md)
- Source ของแผนภาพและเอกสารโครงการอยู่ใน `doc/`, `docs/` และ `ActivityDiagram/`

## ลิขสิทธิ์และสิทธิ์ของโมเดล

Source code ของ repository ใช้สัญญาอนุญาต MIT ตามไฟล์ [LICENSE](LICENSE)

สิทธิ์ของ Source code ไม่ครอบคลุมสิทธิ์ของ Dataset, Model weight และ Ultralytics runtime โดยอัตโนมัติ โมเดล SH17 ที่รวมอยู่เป็น research baseline และต้องผ่านการตรวจสอบสิทธิ์หรือเปลี่ยนเป็นโมเดลที่ใช้ข้อมูลซึ่งอนุญาตเชิงพาณิชย์ก่อนใช้งานจริง ให้ดำเนินการตาม `docs/pilot/COMMERCIALIZATION_GATE.md` ก่อนตั้ง `MODEL_LICENSE_APPROVED=true`

## ผู้จัดทำ

- Nicky
- Krit
