# คู่มือสำหรับ AI Coding Agent — PPE Guard AI

ไฟล์นี้ใช้กำกับ agent ทุกตัวที่ทำงานใน repository นี้ ให้ยึดข้อมูลจาก repository ปัจจุบันเป็นหลัก และรักษาการแก้ไขที่ยังไม่ได้ commit ของผู้ใช้หรือ agent อื่นเสมอ หากมี `AGENTS.md` ที่อยู่ลึกกว่าในโฟลเดอร์ย่อย ให้ปฏิบัติตามไฟล์ที่ใกล้กับไฟล์งานมากที่สุดสำหรับขอบเขตนั้น

## 1. ภาพรวมโปรเจกต์

### ระบบและวัตถุประสงค์

- ชื่อระบบคือ **PPE Guard AI / PPE Detection System** เป็นระบบ edge-first สำหรับตรวจการสวม PPE ในโรงงาน หลักฐาน: `README.md`, `backend/app/core/config.py`
- ขอบเขตการตรวจจับปัจจุบันคือ `person`, `helmet` และ `safety-vest` จากรูปภาพ วิดีโอ หรือกล้อง USB/RTSP หลักฐาน: `README.md`, `backend/app/ml/detector.py`, `backend/app/services/camera_runtime.py`
- กระบวนการหลักคือรับสื่อหรือเฟรมกล้อง → ประมวลผลด้วย YOLO → จับคู่ PPE กับแต่ละคน → ยืนยันการฝ่าฝืนหลายเฟรม → บันทึก Detection/Event/Alert และหลักฐานที่ปกปิดใบหน้า → ส่งผลผ่าน REST/WebSocket ไปยัง dashboard หลักฐาน: `backend/app/services/detection_service.py`, `backend/app/services/camera_runtime.py`, `backend/app/services/temporal_tracker.py`, `backend/app/services/evidence_recorder.py`
- ระบบนี้เป็น academic/pilot safety-support system ไม่ใช่ระบบรับรองความปลอดภัยและไม่แทนที่การกำกับดูแลโดยมนุษย์ หลักฐาน: `README.md`, `docs/pilot/ACCEPTANCE_TEST_PROTOCOL.md`

### Technology stack ที่ตรวจพบ

| ส่วน | เทคโนโลยีที่ใช้อยู่จริง | หลักฐาน |
|---|---|---|
| Backend language/runtime | Python; Docker ใช้ Python 3.11 | `backend/Dockerfile` |
| Backend API | FastAPI 0.109.2 และ Uvicorn 0.27.1 | `backend/requirements.txt`, `backend/app/main.py` |
| Validation/config | Pydantic 2, `pydantic-settings`, environment variables และ `.env` | `backend/requirements.txt`, `backend/app/core/config.py`, `.env.example` |
| Authentication | OAuth2 password flow, JWT (`python-jose`) และ bcrypt/passlib; roles คือ `admin`, `safety_officer`, `viewer` | `backend/app/core/security.py`, `backend/app/api/v1/endpoints/auth.py`, `backend/app/api/v1/endpoints/admin.py` |
| Database | PostgreSQL 15 ใน Docker; SQLAlchemy 2 ORM, `psycopg2-binary` และ Alembic | `docker-compose.yml`, `backend/requirements.txt`, `backend/app/core/database.py`, `backend/alembic/` |
| Test database | SQLite file ชั่วคราวที่สร้างใน temp directory | `backend/tests/conftest.py` |
| AI/CV runtime | Ultralytics 8.4.23, OpenCV, NumPy และ Pillow | `backend/requirements.txt`, `backend/app/ml/detector.py` |
| Model artifacts | `backend/yolo8s.pt`, `backend/yolo8m.pt`, `backend/yolo11n.pt`, `backend/yolov8n.pt`; detector เลือก `MODEL_PATH` ก่อนและตรวจว่ามีคลาสที่ต้องใช้ | `backend/app/ml/detector.py`, `backend/app/core/config.py` |
| Frontend | React 19, TypeScript 5.9, React Router 7 | `frontend/package.json`, `frontend/src/main.tsx`, `frontend/src/App.tsx` |
| Build/styling | Vite/Rolldown, Tailwind CSS 4, PostCSS และ ESLint 9 | `frontend/package.json`, `frontend/vite.config.ts`, `frontend/postcss.config.js`, `frontend/eslint.config.js` |
| Frontend data/state | Axios service layer, Zustand auth store, component state และ WebSocket | `frontend/src/services/api.ts`, `frontend/src/services/`, `frontend/src/stores/authStore.ts` |
| Reporting/UI | Recharts, jsPDF, html2canvas, lucide-react และ react-hot-toast | `frontend/package.json`, `frontend/src/utils/detectionPdfReport.ts` |
| Deployment | Docker Compose แยก `db`, `backend`, `frontend` พร้อม health checks | `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile` |
| Automated validation | Pytest สำหรับ backend; ESLint, TypeScript และ Vite build สำหรับ frontend; GitHub Actions รันชุดเดียวกัน | `backend/tests/`, `frontend/package.json`, `.github/workflows/ci.yml` |

ข้อจำกัดด้านโมเดลที่ต้องรักษา:

- `MODEL_VERSION` เริ่มต้นเป็น `sh17-yolov8s-baseline` และ `MODEL_LICENSE_APPROVED=false` โมเดล SH17 ที่มีอยู่เป็น research baseline ไม่ใช่ commercial release model หลักฐาน: `.env.example`, `backend/app/core/config.py`, `README.md`
- ห้ามอ้างความแม่นยำระดับ production จาก checkpoint หรือ training metric เพียงอย่างเดียว ต้องใช้ protocol และ locked test set ตาม `backend/mlops/README.md` และ `docs/pilot/ACCEPTANCE_TEST_PROTOCOL.md`
- ห้ามนำข้อมูลโรงงานเข้า Git และห้ามเริ่มเก็บข้อมูลก่อนผ่าน approval gate ใน `docs/pilot/DATA_APPROVAL_CHECKLIST.md`
- งานที่เกี่ยวกับการขายหรือ production ต้องตรวจ `docs/pilot/COMMERCIALIZATION_GATE.md` และห้ามเปลี่ยน `MODEL_LICENSE_APPROVED` โดยไม่มีหลักฐานการอนุมัติ

### การเชื่อมต่อ frontend กับ backend

- REST API อยู่ใต้ prefix `/api/v1`; router หลักรวม auth, detection, zones, alerts, settings, cameras, events, admin, WebSocket และ model metadata หลักฐาน: `backend/app/core/config.py`, `backend/app/api/v1/router.py`
- Frontend ใช้ Axios instance จาก `frontend/src/services/api.ts`; base URL มาจาก `VITE_API_URL` หรือ origin ปัจจุบันกับ port `8000` และแนบ JWT จาก `localStorage` ใน `Authorization: Bearer ...`
- Realtime ใช้ authenticated WebSocket ที่ `/api/v1/ws/events` โดยรองรับห้อง `alerts`, `detections`, `cameras` หลักฐาน: `backend/app/api/v1/endpoints/realtime.py`, `frontend/src/services/cameras.ts`
- เมื่อแก้ schema หรือ response ต้องตรวจทั้ง Pydantic schema, endpoint/service, `frontend/src/types/index.ts` และ service/page ที่ใช้ข้อมูลนั้น

### โครงสร้าง repository

- `backend/app/main.py` — FastAPI entry point, lifespan, middleware, health/readiness/metrics
- `backend/app/api/v1/endpoints/` — REST และ WebSocket endpoints แยกตาม domain
- `backend/app/core/` — settings, database session, security และ rate limiting
- `backend/app/models/` — SQLAlchemy ORM models
- `backend/app/schemas/` — Pydantic request/response schemas
- `backend/app/services/` — detection, camera runtime, evidence, email, retention, temporal tracking และ WebSocket coordination
- `backend/app/ml/` — model runtime, training และ evaluation entry points
- `backend/alembic/` — migration environment และ revision files
- `backend/tests/` — Pytest API/security, migration/operations, privacy และ temporal-tracker tests
- `backend/mlops/` — dataset contract และตัวอย่าง YAML สำหรับ train/evaluate
- `backend/scripts/` — operational scripts เช่น pilot soak monitor
- `frontend/src/pages/` — route-level pages
- `frontend/src/components/` — layout และ reusable UI components
- `frontend/src/services/` — typed API/WebSocket access layer
- `frontend/src/stores/` — Zustand state; ปัจจุบันมี auth store
- `frontend/src/types/` — TypeScript contracts ที่ frontend ใช้
- `frontend/src/utils/` — utilities เช่น PDF report
- `docs/pilot/` — data approval, acceptance, operations และ commercialization gates
- `docs/activity/`, `docs/ccd/`, `docs/ssd/` — PlantUML diagrams และเอกสารประกอบโครงงาน
- `SH/` — สำเนาเอกสาร/ข้อมูลอ้างอิงของ SH17; อย่าแก้หรือใช้เป็น commercial data โดยไม่ตรวจสิทธิ์
- `uploads/` และ `backend/uploads/` — runtime artifacts/evidence; ห้าม commit ข้อมูลจริง

## 2. คำแนะนำก่อนเริ่มทุก Session

ก่อนแก้ไขทุกครั้ง agent ต้อง:

1. อ่าน `AGENTS.md` นี้ทั้งหมด
2. อ่าน `README.md` และเอกสารที่เกี่ยวข้องกับ task โดยเฉพาะ `docs/pilot/` สำหรับงานข้อมูล กล้อง ความปลอดภัย หรือ production
3. อ่าน `docs/CODEX_HANDOFF.md` ถ้ามี ปัจจุบัน **ยังไม่พบการตั้งค่าใน repository**
4. รัน `git status --short` และตรวจ diff ของไฟล์ที่จะทำงานก่อนแก้
5. ระบุให้ได้ว่าไฟล์ใดมี uncommitted changes และถือว่าการเปลี่ยนแปลงเหล่านั้นเป็นของผู้ใช้หรือ agent อื่น
6. ห้าม `revert`, `reset`, `checkout`, format ทั้งไฟล์ หรือเขียนทับการแก้ไขที่ไม่ใช่ของ task
7. สรุปขอบเขต เป้าหมาย และสิ่งที่ไม่อยู่ในขอบเขตให้ชัดเจน
8. อ่าน implementation, schema, model, type และ test เดิมที่เกี่ยวข้องก่อนออกแบบของใหม่
9. ค้นหา service, utility, component และ pattern ที่มีอยู่ก่อนสร้าง implementation ใหม่ ห้ามสร้างระบบหรือ abstraction ซ้ำซ้อนโดยไม่จำเป็น
10. ตรวจว่า task กระทบ privacy, model license, authentication, authorization, evidence retention หรือ accuracy claim หรือไม่

ห้าม commit, push, สร้าง PR หรือแก้ไฟล์นอกขอบเขต เว้นแต่ผู้ใช้สั่งอย่างชัดเจน

## 3. Workflow บังคับ

### Step 1: วิเคราะห์และวางแผน

ก่อนเขียนโค้ด:

- อ่านไฟล์ที่เกี่ยวข้องและ trace flow จริงตั้งแต่ boundary ถึง persistence/UI
- ระบุ root cause หรือจุดเปลี่ยนแปลง ไม่แก้จากอาการอย่างเดียว
- ตรวจผลกระทบข้าม backend/frontend, database, camera runtime, evidence และ model contract
- ทำแผนเป็น task ที่ตรวจสอบแยกกันได้
- ระบุไฟล์ที่คาดว่าจะแก้และ validation/test ที่จะรัน
- งานเล็กใช้แผน 1–3 ข้อได้ งานใหญ่ต้องแบ่งเป็น task ย่อยที่จบและทดสอบได้
- แสดงแผนสั้น ๆ ให้ผู้ใช้เห็น แล้วดำเนินการต่อได้ทันที

ต้องหยุดถามผู้ใช้ก่อนลงมือ หากมีกรณีใดกรณีหนึ่งต่อไปนี้ แม้จะพบแนวทางที่เป็นไปได้จากโค้ด:

- requirement ตีความได้หลายแบบและแต่ละแบบเปลี่ยนพฤติกรรมระบบ
- เปลี่ยน database schema หรือ migration
- เพิ่ม ลบ หรืออัปเกรด dependency
- เปลี่ยน public API, response contract หรือ WebSocket contract
- ลบข้อมูล ไฟล์ หลักฐาน หรือ model artifact
- เปลี่ยน authentication, authorization หรือ role permissions
- เปลี่ยน retention/privacy behavior, CORS, secret handling หรือ production configuration
- การเปลี่ยนแปลงอาจกระทบ security, production, model license หรือความน่าเชื่อถือของผลวิจัย

### Step 2: ลงมือทีละ Task

- แก้ตามแผนทีละ task และรักษา scope ที่ตกลงไว้
- ห้าม refactor ส่วนอื่นเพียงเพราะพบว่าสามารถปรับปรุงได้ ให้รายงานเป็น follow-up แทน
- ห้ามเปลี่ยนชื่อไฟล์ ฟังก์ชัน endpoint path, database field หรือ TypeScript contract โดยไม่จำเป็น
- รักษา backward compatibility เมื่อทำได้
- เมื่อแก้ API ให้ตรวจ endpoint + Pydantic schema + SQLAlchemy model/service + `frontend/src/types/index.ts` + frontend service/page ที่เกี่ยวข้อง
- เมื่อใช้ blocking OpenCV, filesystem, SMTP หรือ model inference ใน async flow ให้ใช้ pattern ที่มีอยู่ เช่น `asyncio.to_thread` และต้อง release resource
- ห้ามโหลด YOLO model ใหม่ทุก request; ใช้ singleton/runtime coordination ที่ `backend/app/ml/detector.py` และ `backend/app/services/camera_runtime.py`

### Step 3: ทดสอบหลังจบแต่ละ Task

เลือก validation ที่สัมพันธ์กับไฟล์ที่แก้และมีอยู่จริง:

- Backend behavior/API/security/migration: Pytest ใน `backend/tests/`
- Frontend TypeScript/React: ESLint, TypeScript type-check และ production build
- Database schema: Alembic upgrade และ test ที่เกี่ยวข้อง โดยห้ามใช้ฐานข้อมูลจริงของผู้ใช้
- Camera/CV: unit test ที่ไม่ต้องใช้ hardware ก่อน แล้วระบุชัดหากยังไม่ได้ทดสอบกับ USB/RTSP/GPU จริง
- Docs-only change: ตรวจ diff, path, heading และคำสั่งอ้างอิง ไม่จำเป็นต้องรัน full application test หากไม่มีผลต่อ runtime

ถ้าส่วนที่แก้ควรมี test และ Pytest ที่มีอยู่รองรับ ให้เพิ่ม test ใกล้เคียงใน `backend/tests/` ห้ามพึ่งการทดสอบ manual อย่างเดียว

Frontend **ยังไม่พบการตั้งค่า test framework ใน repository** และไม่มี `test` script ใน `frontend/package.json` ห้ามเพิ่ม test dependency/framework เอง ให้ใช้ lint, type-check, build หรือ manual smoke test และเสนอ setup ให้ผู้ดูแลโปรเจกต์อนุมัติก่อน

### Step 4: แก้ Test Failure

เมื่อ validation fail:

1. อ่าน error, stack trace และ command context ให้ครบ
2. แยกว่าเกิดจากงานปัจจุบัน, environment/hardware หรือเป็น pre-existing failure
3. แก้ root cause แบบตรงจุด
4. รัน test เดิมซ้ำ และรัน regression test ที่เกี่ยวข้อง

ห้ามทำเพื่อบังคับให้ test ผ่าน:

- comment หรือ delete test
- `skip`/`xfail` โดยไม่มีเหตุผลและการอนุมัติ
- ลด assertion หรือเปลี่ยน expected result ให้เข้ากับ behavior ที่ผิด
- catch exception แล้วปล่อยผ่าน
- ปิด ESLint หรือ TypeScript rule ทั้งโปรเจกต์
- ใช้ `any`, `@ts-ignore`, `# type: ignore`, `noqa` หรือ suppression โดยไม่มีเหตุผลเฉพาะจุด
- อ้างว่า failure เดิมเกิดจาก task ปัจจุบันโดยไม่มี baseline หรือหลักฐาน

### Step 5: ตรวจสอบคุณภาพเพิ่มเติม

ตรวจเฉพาะด้านที่สัมพันธ์กับ task:

- invalid, empty และ missing values รวมถึง boundary ของ confidence, pagination และ file size
- loading, empty, success และ error state ใน frontend
- frontend/backend data contract และ nullable/optional fields
- transaction, commit/rollback, session lifecycle และ Alembic migration safety
- race condition ระหว่าง camera tasks, WebSocket clients, email retries และ retention job
- `VideoCapture`, `VideoWriter`, uploaded file, database session, task และ model resource ถูกปิด/release
- path traversal, unsafe filename/extension/MIME และการเข้าถึง protected evidence
- SQL/command/template injection และ subprocess argument handling
- authentication/authorization ทุก resource โดยเฉพาะ camera, event, alert, user และ media
- ห้ามเปิดเผย RTSP credential, JWT, password reset token, SMTP secret, stack trace หรือข้อมูลส่วนบุคคล
- CORS และ API access control ต้องมาจาก config
- memory ของวิดีโอ/เฟรม, CPU/GPU fallback, inference lock, model loading ซ้ำ และ loop ที่ไม่มีขอบเขต
- N+1 query, query ที่อ่านทุก row และ retention/metrics ที่โตตามข้อมูล
- duplicated logic, magic values และ technical debt ที่เกิดจากงานปัจจุบัน
- สำหรับ ML ให้ตรวจ data leakage, per-class metrics, event-level metrics, model version และ dataset/license provenance

### Step 6: แก้ไขและทดสอบซ้ำ

- แก้ปัญหาที่พบจาก Step 5 ภายใน scope
- กลับไป Step 3 และรัน validation ชุดเดิมซ้ำ
- ทำซ้ำจน test/validation ที่เกี่ยวข้องผ่าน หรือรายงาน blocker ที่พิสูจน์ได้
- ห้ามเรียกงานว่าเสร็จ หาก validation สำคัญยัง fail โดยไม่มีคำอธิบาย

### Step 7: สรุปงาน

รายงานผลด้วยข้อมูลที่ตรวจสอบได้:

- สิ่งที่เปลี่ยน และ root cause หากเป็น bug fix
- รายการไฟล์ที่แก้
- command/test/validation ที่รันจริงและผลแต่ละรายการ
- security, privacy, API contract หรือ performance checks ที่ทำเพิ่ม
- pre-existing failures แยกจาก failure ที่เกิดจากงานนี้
- สิ่งที่ยังไม่ได้ตรวจ เช่น hardware, RTSP, SMTP, PostgreSQL, GPU หรือ browser จริง
- สิ่งที่ผู้ใช้ควรทดสอบเองและงานต่อเนื่องที่จำเป็น

ห้ามเขียนว่า “ผ่าน”, “production-ready”, “แม่นยำ” หรือ “ปลอดภัย” หากไม่ได้รันและมีหลักฐานรองรับตามขอบเขตนั้น

## 4. มาตรฐานการเขียนโค้ด

### Python / FastAPI

- ใช้ `snake_case` สำหรับ module, function, variable และ field; ใช้ `PascalCase` สำหรับ class, SQLAlchemy model, Pydantic schema และ service class
- เพิ่ม type hints สำหรับ public function, service boundary และค่าคืนที่ไม่ชัดเจน รักษารูปแบบ Python 3.10+ เช่น `str | None`, `list[str]`, `dict[str, Any]`
- Endpoint อยู่ใน `backend/app/api/v1/endpoints/` และประกอบ router ใน `backend/app/api/v1/router.py`
- ใช้ `Depends(get_db)` สำหรับ request-scoped SQLAlchemy session และ `Depends(get_current_user)`/role checks สำหรับ protected endpoint
- กรณีสร้าง `SessionLocal()` เอง เช่น background task ต้องปิดใน `finally`; transaction failure ต้อง rollback ก่อน reuse/exit เมื่อเกี่ยวข้อง
- Pydantic response จาก ORM ใช้ `ConfigDict(from_attributes=True)` ตาม schema ปัจจุบัน
- Settings ที่เปลี่ยนตาม environment ต้องเพิ่มใน `backend/app/core/config.py` และตัวอย่างใน `.env.example`; ห้าม hardcode secret, database URL, recipient หรือ deployment host
- ใช้ `logging.getLogger(__name__)` และ structured/contextual logging ตาม `backend/app/main.py` และ services ห้ามเพิ่ม `print` สำหรับ production path ใหม่
- Async endpoint ต้องไม่เรียก blocking CV/file/network work ตรง ๆ ให้ใช้ `asyncio.to_thread` หรือออกแบบ worker ตาม pattern ปัจจุบัน
- ใช้ `pathlib.Path` และตรวจ resolved path สำหรับ upload/evidence ห้ามเชื่อ filename จาก client
- Public function/class หรือ logic ที่ซับซ้อนควรมี docstring อธิบาย contract/เหตุผล ไม่อธิบาย syntax
- รักษา import groups แบบ standard library → third-party → `app.*`; อย่าจัดรูปแบบทั้งไฟล์ที่มี diff ค้างเพียงเพื่อเรียง import

Python formatter, linter และ static type-check config: **ยังไม่พบการตั้งค่าใน repository** ต้องยืนยันกับผู้ดูแลโปรเจกต์ก่อนเพิ่ม Black, Ruff, Flake8, isort หรือ mypy และห้ามเดาคำสั่งเอง

### SQLAlchemy / Alembic

- Models อยู่ใน `backend/app/models/` และต้อง import ผ่าน `backend/app/models/__init__.py` เพื่อให้ metadata ครบ
- การเปลี่ยน schema ต้องได้รับการยืนยันก่อน และต้องมี Alembic revision ใน `backend/alembic/versions/`
- Production ใช้ `alembic upgrade head`; `AUTO_CREATE_TABLES` ต้องเป็น `false` ใน production ตาม `backend/app/core/config.py`
- ห้ามแก้ database file (`*.db`) หรือ production PostgreSQL เพื่อ “ทดสอบ” migration
- ระวัง nullable/default/index/foreign key และ downgrade/data preservation; migration ต้องทดสอบซ้ำได้ตาม test ที่มี

### TypeScript / React

- TypeScript เปิด `strict`, `noUnusedLocals`, `noUnusedParameters` และ `noFallthroughCasesInSwitch`; ห้ามลดค่าพวกนี้เพื่อแก้ error หลักฐาน: `frontend/tsconfig.app.json`
- ใช้ `PascalCase` สำหรับ React component/page และ interface/type; ใช้ `camelCase` สำหรับ function, hook, variable และ service method
- ใช้ function components และ hooks; route-level page อยู่ใน `frontend/src/pages/`, reusable UI อยู่ใน `frontend/src/components/`
- API call ต้องผ่าน module ใน `frontend/src/services/` และ shared Axios instance ใน `services/api.ts` ห้ามกระจาย `fetch`/hardcoded API URL เข้า component โดยไม่มีเหตุผล
- Shared API data contract อยู่ใน `frontend/src/types/index.ts`; หลีกเลี่ยงการประกาศ response shape ซ้ำหลายหน้า
- Auth state ใช้ `useAuthStore` จาก Zustand; local UI state ใช้ React hooks ตาม pattern ปัจจุบัน
- ใช้ `import type` สำหรับ type-only import ตาม TypeScript config
- รองรับ loading, empty, success และ error state; cleanup timer, media stream, object URL และ WebSocket ใน effect cleanup
- Protected media ต้องโหลดพร้อม Authorization ตาม `ProtectedDetectionImage.tsx`; ห้ามใช้ public URL ตรง ๆ หาก endpoint ต้องยืนยันตัวตน
- Styling ปัจจุบันใช้ Tailwind utility classes ร่วมกับ CSS variables/global helpers ใน `frontend/src/index.css` และ inline style บางส่วน ให้รักษารูปแบบของ component ที่แก้และหลีกเลี่ยงการสร้าง styling system ใหม่
- API base URL ใช้ `VITE_API_URL`; ห้าม hardcode token, secret, password, database credential หรือ customer endpoint

### หลักทั่วไป

- ใช้ชื่อที่สื่อความหมายและให้ฟังก์ชันมีหน้าที่ชัดเจน
- reuse utility/service/component เดิมก่อนสร้างใหม่
- หลีกเลี่ยง duplicated logic, magic number และ magic string; runtime/pilot tuning ต้องอยู่ใน settings หรือ named constants
- ห้าม log secret, JWT, password, reset token, RTSP credential, raw face data หรือข้อมูลส่วนบุคคล
- Comment อธิบาย “เหตุผล” หรือ constraint ที่ไม่ชัดจากโค้ด ไม่อธิบาย syntax
- รักษารูปแบบเดิมของ repository และทำ diff ให้เล็กก่อนเสนอ refactor ใหม่

## 5. Error Handling

- ห้ามใช้ `except Exception: pass` หรือกลืน error โดยไม่มี log, fallback ที่ตั้งใจไว้ หรือการส่งต่อ
- จับ exception ที่เฉพาะเจาะจงเมื่อทราบชนิด; ใช้ broad exception เฉพาะ boundary ที่ต้องป้องกัน task/process ล้ม และต้อง log context
- Validate input ที่ boundary: Pydantic schema, query constraints, role, MIME/extension/size, camera source และ resolved file path
- FastAPI ใช้ `HTTPException` พร้อม status code ที่ถูกต้อง เช่น 400 input, 401 authentication, 403 authorization, 404 missing resource, 409 state conflict
- Error ที่ส่งผู้ใช้ต้องไม่เปิดเผย stack trace, absolute internal path, SQL, token, credential หรือ raw exception จาก dependency; log รายละเอียดภายในด้วย request/camera/event context
- Resource cleanup ใช้ context manager หรือ `finally`: `UploadFile`, `VideoCapture`, `VideoWriter`, database session, file handle, WebSocket, asyncio task และ temporary artifact
- Camera failure ต้องเก็บ state/error ที่วินิจฉัยได้ จำกัดความยาว และไม่เปิดเผย RTSP credential
- Background email/retention/camera task ต้องไม่ทำให้ request loop ค้าง และต้องมี retry/cancellation behavior ที่ชัดเจน
- Frontend ต้องจัดการ loading/empty/success/error และไม่แสดง `error.response.data` หรือ raw backend error โดยตรงโดยไม่กรอง
- WebSocket message ที่ malformed สามารถใช้ polling fallback ตาม pattern ปัจจุบัน แต่ห้ามปิดบัง connection/auth failure ที่ผู้ใช้ต้องแก้
- หาก fallback ทำให้คุณภาพผลลัพธ์ลดลง เช่น CPU/OpenCV/video codec ต้อง log และรายงานข้อจำกัด ห้ามแสดงว่าผลเทียบเท่าโดยไม่มีการวัด

## 6. คำสั่งที่ใช้บ่อย

คำสั่งต่อไปนี้ยืนยันจากไฟล์ใน repository แล้ว ให้รันจาก working directory ที่ระบุ

### Backend setup และ development

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

หลักฐาน: `README.md`, `backend/requirements.txt`, `backend/alembic.ini`

### Backend tests

รันทั้งหมด:

```powershell
cd backend
python -m pytest -q
```

รันเฉพาะไฟล์:

```powershell
cd backend
python -m pytest tests/test_api_security.py -q
python -m pytest tests/test_temporal_tracker.py -q
```

Test files ที่มีอยู่จริง: `test_api_security.py`, `test_temporal_tracker.py`, `test_evidence_privacy.py`, `test_operations.py`

### Frontend setup และ development

```powershell
cd frontend
npm ci
npm run dev
```

หลักฐาน: `README.md`, `frontend/package.json`, `frontend/package-lock.json`

### Frontend validation และ build

```powershell
cd frontend
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

Preview build ที่สร้างแล้ว:

```powershell
cd frontend
npm run preview
```

Frontend unit/component test command: **ยังไม่พบการตั้งค่าใน repository**  
Format command ทั้ง backend และ frontend: **ยังไม่พบการตั้งค่าใน repository**  
ต้องยืนยันกับผู้ดูแลโปรเจกต์ก่อนเพิ่ม tooling หรือ dependency เหล่านี้

### Database migration

```powershell
cd backend
alembic upgrade head
```

การสร้าง revision ใหม่ไม่มีคำสั่งที่กำหนดไว้ในเอกสารโครงการ ต้องยืนยันชื่อและขอบเขต migration กับผู้ดูแลโปรเจกต์ก่อน

### Docker / production-like start

```powershell
Copy-Item .env.example .env
# แก้ placeholder และ secrets ใน .env ก่อนรัน
docker compose up --build
```

Backend container รัน `alembic upgrade head` ก่อน Uvicorn และ frontend container serve ไฟล์จาก `dist` หลักฐาน: `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml`

### Model training และ evaluation

ใช้ได้เฉพาะ dataset ที่ผ่าน approval และอยู่นอก Git:

```powershell
cd backend
Copy-Item mlops\ppe_factory.example.yaml mlops\ppe_factory.yaml
python -m app.ml.train_ppe --data mlops/ppe_factory.yaml --model yolo8s.pt --name factory-yolo8s-v1
python -m app.ml.evaluate_ppe --data mlops/ppe_factory.yaml --model experiments/factory-yolo8s-v1/weights/best.pt --split test --output experiments/factory-yolo8s-v1/test_metrics.json
```

ก่อนรันให้อ่าน `backend/mlops/README.md`, `docs/pilot/DATA_APPROVAL_CHECKLIST.md` และ `docs/pilot/COMMERCIALIZATION_GATE.md`

## 7. Checklist ก่อนส่งมอบงาน

- [ ] อ่าน `git status` และยืนยันว่า diff มีเฉพาะไฟล์ใน scope
- [ ] ไม่ลบหรือเขียนทับ uncommitted changes เดิม
- [ ] ตรวจ frontend/backend/database contract หากเกี่ยวข้อง
- [ ] เพิ่มหรือปรับ test ที่เหมาะสมโดยไม่ลดคุณภาพ assertion
- [ ] รันคำสั่ง validation จริงและบันทึกผลตามจริง
- [ ] ตรวจ security/privacy/resource cleanup ที่เกี่ยวข้อง
- [ ] ระบุ hardware, GPU, USB/RTSP, SMTP, PostgreSQL หรือ browser validation ที่ยังไม่ได้รัน
- [ ] ไม่ commit/push โดยไม่ได้รับคำสั่ง
- [ ] สรุปไฟล์ที่แก้, root cause, tests, ผลลัพธ์, ข้อจำกัด และ next step
