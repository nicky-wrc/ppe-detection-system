# Codex Handoff — PPE Guard AI

## Follow-up — Detection live persistence and alert sound (2026-07-30)

- หน้า Detection ยังใช้ `/detection/frame` สำหรับผล overlay ชั่วคราว แต่ frontend จะยืนยัน violation signature เดิม 2 เฟรมติดกันก่อนเรียก authenticated `/detection/image` เพื่อบันทึก Detection/Alert และหลักฐานผ่าน flow เดิม
- ตรวจเฟรมทุก 1 วินาที, reset episode หลัง clear 2 เฟรม, ใช้ cooldown 60 วินาทีต่อ violation signature และหน่วง retry การบันทึกที่ไม่สำเร็จ 10 วินาที เพื่อไม่ให้บันทึกหรือส่งเสียงทุกเฟรม
- `DetectionService._create_alerts` เปลี่ยนเป็น async และ broadcast Alert ไปยัง WebSocket room `alerts` โดยจำกัด `user_id` เจ้าของ ทำให้หน้า Detection ใช้เสียงและ toast จาก Layout เดียวกับหน้า Cameras โดยยังเคารพค่า `alert_sound` ของผู้ใช้
- เพิ่ม `backend/tests/test_detection_alerts.py` ตรวจทั้ง Alert rows, payload และ user targeting; backend full suite ผ่าน `46 passed` (มี 9 `python-jose` deprecation warnings เดิม), frontend ESLint/TypeScript ผ่าน และ isolated Vite production build ผ่าน
- ยังไม่ได้ทดสอบ end-to-end ด้วย browser + webcam + speaker จริง จึงต้อง smoke test การตรวจต่อเนื่อง, History/Alerts และเสียงบน browser ของผู้ใช้ก่อนสาธิต

## Session update — 2026-07-30 (Hybrid detector, smooth camera, Apple-inspired UI)

### Follow-up — camera person-fusion accuracy guard

- ปรับ `backend/app/ml/detector.py` ให้รวม person box จาก SH17 และ YOLO11 แบบ source-aware โดยใช้ containment ร่วมกับ IoU เพื่อไม่ให้นับคนเดียวซ้ำเมื่อโมเดลหนึ่งให้กล่องลำตัวและอีกโมเดลให้กล่องที่แคบกว่า
- เพิ่ม geometry guard สำหรับกล่องที่เล็กผิดปกติและชิ้นส่วนแคบที่ติดขอบภาพ ซึ่งไม่เพียงพอสำหรับประเมิน PPE
- คงการเบลอหน้าไว้ เพราะทำหลัง inference และการเอาออกไม่ช่วย accuracy แต่เพิ่มความเสี่ยงด้าน privacy
- เพิ่ม regression tests จากรูปแบบกล่องที่พบจริง: nested cross-model boxes, false person ขนาดประมาณ 12×30 px, คนสองคนที่อยู่ใกล้กัน, คนระยะไกลที่ยังสมเหตุสมผล และ partial edge sliver
- Validation: `test_hybrid_detector.py` ผ่าน 10 tests; backend full suite ผ่าน 39 tests และมี 9 deprecation warnings เดิมจาก `python-jose`
- Live in-memory check บน USB camera 0 ยืนยันว่า false person บริเวณฉากหลังที่ confidence 0.61 และ partial person ที่ติดขอบขวาถูกกรองออก เหลือ `person_count=0`; ไม่มีการบันทึก diagnostic frame ลงดิสก์
- ข้อจำกัดเดิมยังอยู่: SH17 ไม่สร้าง helmet/vest candidate ในเฟรมที่ PPE ไม่อยู่ในมุมมอง จึงแก้ไม่ได้ด้วย threshold หรือ post-processing และยังต้องใช้ approved target dataset/fine-tuning พร้อม locked evaluation ก่อนอ้าง accuracy

### Follow-up — helmet/vest association and smoother authorized preview

- พบจาก evidence ล่าสุดว่า SH17 ตรวจหมวกสีแดงได้ confidence ประมาณ `0.63–0.79` แต่ helmet association region เดิมแคบเกินไปเมื่อ person box สูง/หลวม จึงขยาย head matching region พร้อม regression test
- map SH17 `safety-suit` เป็น pilot contract `safety-vest`; โมเดลเรียกเสื้อสะท้อนแสงสีเหลืองด้านข้างว่า `safety-suit` ที่ confidence ประมาณ `0.27`
- เปิด test-time augmentation เฉพาะ person-crop refinement ด้วย guarded rescue confidence เพื่อกู้เสื้อด้านหน้าที่ full-frame inference พลาด โดยยังใช้ spatial association และ temporal confirmation เดิม
- replay บน evidence ล่าสุด: เสื้อด้านหน้าพบที่ confidence `0.38`, เสื้อด้านข้าง `0.27`, หมวก `0.71–0.90`; เป็น targeted replay ไม่ใช่ locked accuracy result
- USB capture ขอ `1280×720 @ 30 FPS` และยืนยันกับ camera 0 แล้วว่าอุปกรณ์ตอบค่าดังกล่าว; analysis/preview target เพิ่มเป็น 15 FPS สำหรับ local one-camera demo
- authorized Camera preview ไม่เบลอและไม่ persist เพื่อให้ตรวจภาพ/overlay ได้ชัด แต่ persisted snapshot/clip ยังผ่าน `blur_person_heads` เหมือนเดิม; endpoint ยังคงจำกัด `admin`/`safety_officer` และส่ง `Cache-Control: no-store`
- frontend poll preview ทุก 70 ms; lint และ TypeScript ผ่าน, isolated production build ผ่าน ส่วน standard `dist` build ยังติด Windows `EPERM` จากไฟล์เดิมที่ process อื่นล็อก
- Backend full suite ล่าสุด `45 passed`, มี 9 deprecation warnings เดิมจาก `python-jose`; benchmark 1280×720 หลัง warm-up เฉลี่ย `44.25 ms/frame` (ประมาณ 22.6 inference FPS) บน RTX 4070

สถานะล่าสุดของ working tree ก่อนจบ session นี้:

- Branch `nicky_dev`; baseline commit ก่อนเริ่มงานคือ `234cbfb` (`Codex_Handoff`)
- `apple-music.design.md` เป็นไฟล์ untracked ของผู้ใช้และยังไม่ได้แก้ไข
- ห้าม commit/push โดยอัตโนมัติ งานทั้งหมดของ session นี้ยังเป็น working-tree changes
- Backend ที่ port `8000` ถูกเปิดด้วย `backend/.venv` แบบ CUDA และกล้องทั้งหมดถูกหยุดหลัง hardware test

### สิ่งที่ทำเสร็จใน session นี้

- เปลี่ยน runtime เป็น hybrid:
  - `backend/yolo8m.pt` (SH17) ตรวจ `person`, `helmet`, `safety-vest`
  - `backend/yolo11n.pt` (COCO) ช่วยตรวจ `person`; checkpoint นี้ไม่มีคลาส PPE จึงห้ามใช้ตัดสิน helmet/vest โดยตรง
  - รวม person boxes ด้วย NMS, ตรวจ PPE ซ้ำจาก person crop เมื่อมี CUDA และจับคู่ helmet กับ head region / vest กับ torso region
- เพิ่ม conditional CLAHE เฉพาะเฟรมที่ค่า luminance ต่ำกว่า `LOW_LIGHT_LUMA_THRESHOLD`
- แก้ semantic bug ของ Settings: `confidence_threshold` เป็น person confidence และ `ppe_detection_sensitivity` ถูก map เป็น PPE confidence จริงแล้ว
- เพิ่ม metadata ของ hybrid strategy ใน `GET /api/v1/models/active`
- ปรับ camera target เป็น 10 analyzed/preview FPS, capture buffer 1 เฟรม, JPEG quality 80 และ frontend poll ทุก 120 ms
- ปรับ tracker ให้ทนต่อ bounding-box jitter และเพิ่ม spatial event cooldown เพื่อกัน alert flood เมื่อ track ID เปลี่ยน
- แก้ retention warning spam โดยข้าม non-file references `expired`, `camera:<id>` และ `live-camera-frame` แต่ยังปฏิเสธ path จริงที่อยู่นอก configured root
- สร้าง frontend design system จากหลักการใน `apple-music.design.md` โดยปรับเป็น PPE operations UI:
  - system fonts, parchment/white surfaces, action blue, safety red-magenta-aubergine gradient
  - translucent navigation, mobile bottom navigation, dashboard safety hero
  - redesign หน้า Login และ Cameras; อธิบาย Stop/Remove และเพิ่ม confirmation ก่อน Remove
  - หน้า Settings แสดงชื่อ hybrid model และอธิบาย threshold/sensitivity ตรงกับ backend

### Runtime และ benchmark ที่ยืนยันจริง

- `backend/.venv`: PyTorch `2.10.0+cu128`, CUDA available, NVIDIA GeForce RTX 4070 12 GB
- Hybrid inference บนภาพ 1280×720 ไม่มีคน: เฉลี่ยประมาณ 30.3 ms (ประมาณ 33 FPS เฉพาะ inference)
- Hybrid inference บนภาพ 1080p ที่มี 5 คนและ crop refinement: เฉลี่ยประมาณ 71.1 ms
- USB camera index 0 เปิดได้จริง: 640×480, source 30 FPS
- กล้องจริงหลัง warm-up: ประมาณ 8.48 analyzed FPS, preview endpoint ตอบ `200 image/jpeg` ขนาดประมาณ 50 KB
- เฟรม webcam ที่ทดสอบมี mean luma 58.53 จึงเปิด low-light enhancement และตรวจ person ได้คงที่ 2 คนในตัวอย่าง 5 เฟรม
- ผลนี้เป็น runtime smoke test ไม่ใช่หลักฐานความแม่นยำของโมเดล

Hardware test สร้าง violation logs IDs `35–56` บน camera 1 เพราะผู้ทดสอบไม่ได้สวม PPE ระหว่างวัด throughput ระบบไม่ได้ลบรายการเหล่านี้อัตโนมัติ ให้ผู้ดูแลตัดสินใจว่าจะเก็บเป็น test evidence หรือลบด้วยขั้นตอนข้อมูลที่ตรวจสอบแล้ว

### Validation ล่าสุด

- Backend full suite: `34 passed`, มี 9 deprecation warnings เดิมจาก `python-jose`
- Targeted hybrid/retention/tracker tests ล่าสุดผ่าน (`test_hybrid_detector.py`, `test_retention_service.py`, `test_temporal_tracker.py`)
- Frontend `npm run lint`: ผ่าน
- Frontend `npx tsc -b --pretty false`: ผ่าน
- Standard `npm run build`: transform ผ่านแต่ล้มที่ `EPERM` เพราะไฟล์เดิมใน `frontend/dist/assets` ถูก process อื่นล็อก
- Isolated build ผ่านด้วย `npx vite build --outDir node_modules/.ppe-build-verify-20260730`
- ตรวจ screenshot หน้า Login จริงที่ desktop viewport แล้ว; ไฟล์ screenshot อยู่ใน `D:\tmp` และไม่ใช่ repository artifact

### งานสำคัญที่ยังต้องทำ

1. สร้าง approved factory dataset ที่ครอบคลุมมุมกล้อง, ระยะ, occlusion, PPE สีต่าง ๆ และ low-light แล้วทำ locked test split
2. วัด per-class/event precision, recall, F1, AP, false alerts/camera-hour และ missed violations; ห้ามอ้างว่า “แม่นยำที่สุด” ก่อนมีผลนี้
3. ทดสอบพร้อมกัน 2–4 cameras, RTSP, 8-hour soak, reconnect และ VRAM/RAM/disk growth
4. ตรวจและล้าง test events IDs `35–56` เฉพาะเมื่อผู้ใช้อนุมัติการลบข้อมูลชัดเจน
5. แก้ Windows lock ของ `frontend/dist` เมื่อ process ที่ถือไฟล์ถูกปิด; ห้ามลบ `frontend/dist-check` โดยไม่ตรวจ diff/รับคำสั่ง
6. ตรวจ commercial license ของ SH17 checkpoint/data และ Ultralytics runtime ก่อนตั้ง `MODEL_LICENSE_APPROVED=true`

เอกสารนี้เป็นจุดส่งต่องานระหว่าง Codex sessions สำหรับ repository นี้ ให้อ่านร่วมกับ `AGENTS.md`, `README.md` และเอกสารที่เกี่ยวข้องใน `docs/pilot/` ก่อนเริ่มทำงานทุกครั้ง

> ห้ามนำ password, token, connection string ที่มี credential, ภาพโรงงาน หรือข้อมูลส่วนบุคคลมาใส่ในไฟล์นี้

## 1. เป้าหมายของผู้ใช้

ผู้ใช้ต้องการพัฒนา **PPE Guard AI / PPE Detection System** ให้เป็นโครงงานจบที่:

- สาธิตการตรวจ `person`, `helmet` และ `safety-vest` จากภาพ วิดีโอ และกล้องได้จริง
- มีหลักฐานเชิงวิจัยเพียงพอสำหรับการตีพิมพ์ โดยไม่กล่าวอ้างความแม่นยำเกินผลทดลอง
- พัฒนาไปสู่ pilot ที่โรงงานทดลองใช้งานได้
- มี roadmap ไปสู่ผลิตภัณฑ์ที่ขายให้บริษัทชั้นนำได้ โดยต้องผ่านข้อกำหนดด้าน model/data license, privacy, security, reliability และ operations ก่อน

ระบบนี้ยังเป็น **academic/pilot safety-support system** ไม่ใช่ระบบรับรองความปลอดภัย และไม่สามารถแทนที่การกำกับดูแลโดยมนุษย์

## 2. Snapshot ล่าสุด

ข้อมูล ณ `2026-07-29 23:03 +07:00`:

- Branch: `nicky_dev`
- HEAD: `3edf69d3ffab20155b59249f7d1d80cb440c39d9`
- `origin/nicky_dev` ชี้ที่ commit เดียวกัน
- Working tree สะอาดก่อนสร้างเอกสารนี้
- Commit สำคัญ:
  - `3c396d3` — งาน pilot/security/camera/events/frontend/MLOps ชุดใหญ่
  - `3edf69d` — live camera preview และ research evaluation tooling
- ห้ามถือว่า snapshot นี้ยังตรงกับ repository ใน session ถัดไป ต้องรัน `git status --short` และ `git log -3 --oneline --decorate` ใหม่เสมอ

ประมาณการความพร้อมจากแผนเดิม เป็น planning estimate ไม่ใช่ผลรับรอง:

| เป้าหมาย | ความพร้อมโดยประมาณ |
|---|---:|
| Core pilot/MVP | 85% |
| พร้อมสาธิตโครงงานจบ | 75% |
| พร้อมตีพิมพ์ | 45–50% |
| พร้อมทดลองในบริษัทจริง | 50% |
| พร้อมขายระดับ enterprise | 30% |
| ภาพรวมเป้าหมายทั้งหมด | 55–60% |

ช่องว่างหลักไม่ได้อยู่ที่จำนวนหน้าจอ แต่เป็น approved dataset, locked evaluation, field validation, license, privacy, security และ production architecture

## 3. Architecture และขอบเขตที่มีอยู่จริง

```text
React/Vite UI ─────── FastAPI ─────── PostgreSQL
       │                 │
       └── WebSocket ────┤
                         └── in-process camera runtime ── YOLO SH17
                                                        ├── temporal confirmation
                                                        └── blurred evidence + authorized memory-only preview
```

- Backend: Python, FastAPI, SQLAlchemy, Alembic, PostgreSQL
- Frontend: React 19, TypeScript, Vite, Axios, Zustand, Tailwind CSS
- AI/CV: Ultralytics YOLO, OpenCV, NumPy, Pillow
- Authentication: OAuth2 password flow, JWT, bcrypt/passlib
- Roles: `admin`, `safety_officer`, `viewer`
- Realtime: authenticated WebSocket ที่ `/api/v1/ws/events`
- Camera runtime และ rate limiter ยังอยู่ใน process ของ API เหมาะกับ single-edge pilot เท่านั้น
- Test database ใช้ SQLite ชั่วคราวตาม `backend/tests/conftest.py`

## 4. งานที่ทำเสร็จแล้ว

### 4.1 Security และ application foundation

- เพิ่ม environment-based settings และ production validation
- เพิ่ม JWT authentication และ role-based access control
- ปิด public registration โดย default
- รองรับ one-time admin bootstrap ผ่าน environment variables
- เพิ่ม protected media endpoints และ authenticated WebSocket
- เพิ่ม in-memory pilot rate limiter
- เพิ่ม liveness, readiness และ Prometheus-format metrics
- เพิ่ม CORS config จาก environment

ไฟล์หลัก: `backend/app/core/config.py`, `backend/app/core/security.py`, `backend/app/core/rate_limit.py`, `backend/app/main.py`

### 4.2 Database และ API

- เพิ่ม Alembic และ revision `20260729_01_edge_camera_events.py`
- เพิ่ม camera, event, alert delivery และ operational fields
- เพิ่ม API groups สำหรับ admin users, cameras, events, realtime และ active model metadata
- เพิ่ม event acknowledge/resolve และ protected snapshot/clip access

ไฟล์หลัก: `backend/alembic/`, `backend/app/api/v1/endpoints/`, `backend/app/models/`, `backend/app/schemas/`

### 4.3 Detection และ camera runtime

- ตรวจจับจาก image upload, video/frame และ registered camera
- รองรับ USB, RTSP และ file source ตาม schema ปัจจุบัน
- โหลด model ผ่าน detector runtime และตรวจ required classes
- จับคู่คนข้ามเฟรมด้วย IoU tracker แบบ lightweight
- ยืนยัน violation เมื่อพบ 4 ใน 5 analyzed frames
- clear confirmed state หลัง compliant ต่อเนื่อง 3 เฟรม
- duplicate-event cooldown default 60 วินาที
- reconnect backoff สูงสุด default 30 วินาที
- เก็บ camera health, measured FPS, analyzed frames และ last error

ไฟล์หลัก: `backend/app/ml/detector.py`, `backend/app/services/camera_runtime.py`, `backend/app/services/temporal_tracker.py`

### 4.4 Live camera preview

- เมื่อกด Start หน้า Cameras จะแสดง preview จากเฟรมที่ backend กำลังวิเคราะห์
- Preview endpoint: `GET /api/v1/cameras/{camera_id}/preview`
- จำกัดสิทธิ์ `admin` และ `safety_officer`
- คืน `204 No Content` ระหว่างรอเฟรมแรก เพื่อลด expected browser errors
- Preview เป็น JPEG ลดขนาดสูงสุด 960 px และ target update 15 FPS สำหรับ local one-camera demo
- Frontend poll ทุก 70 ms แบบ sequential request
- เก็บ preview ใน memory เท่านั้น ไม่บันทึกลงดิสก์
- Preview ไม่เบลอเพื่อให้ผู้มีสิทธิ์ตรวจภาพและ overlay ได้ชัด; endpoint จำกัด `admin`/`safety_officer` และห้าม browser cache
- Snapshot/clip ที่ persist ยังผ่าน best-effort head/face blur; การ blur ไม่ใช่การรับประกัน anonymization

ไฟล์หลัก: `backend/app/api/v1/endpoints/cameras.py`, `backend/app/services/camera_runtime.py`, `frontend/src/pages/CameraPage.tsx`, `frontend/src/services/cameras.ts`

### 4.5 Evidence, events และ alerts

- เก็บ privacy-filtered snapshot และ evidence clip
- default pre-event 5 วินาที และ post-event 10 วินาที
- ส่ง alert ผ่าน dashboard/WebSocket
- รองรับ SMTP delivery พร้อม delivery state/retry
- Evidence retention default 30 วัน
- Event metadata ตั้งเป้า retention 365 วัน แต่ต้องตรวจ implementation เพิ่มเติมก่อนกล่าวว่ามี metadata purge ครบ
- Dashboard, History, Alerts, PDF/CSV reporting และ Settings มีอยู่แล้ว

ไฟล์หลัก: `backend/app/services/evidence_recorder.py`, `backend/app/services/email_notifier.py`, `backend/app/services/retention_service.py`, `frontend/src/pages/`

### 4.6 Research และ MLOps tooling

- มี reproducible training entry point: `backend/app/ml/train_ppe.py`
- Frame evaluator รายงาน aggregate metrics, per-class precision/recall/F1/AP50/AP50-95, timing และ SHA-256 ของ model/dataset manifest
- Event evaluator อ่าน locked ground-truth CSV และ prediction CSV
- Event matching เป็น deterministic maximum one-to-one assignment
- รายงาน TP/FP/FN, precision, recall, F1, false alerts และ missed violations ต่อ camera-hour, latency p50/p95
- `--require-pass` คืน exit code `2` เมื่อไม่ผ่าน locked acceptance target แต่ยังเขียนรายงานก่อนออก
- มี protocol สำหรับ dataset, pilot acceptance, data approval, operations และ commercialization

ไฟล์หลัก: `backend/app/ml/evaluate_ppe.py`, `backend/app/ml/evaluate_events.py`, `backend/mlops/README.md`, `docs/pilot/`

### 4.7 Frontend และ operations

- Protected routes และ role-aware navigation
- Admin user management
- Camera registration/control/health/live preview
- Alert และ event review
- Dashboard analytics และ report export
- Docker Compose แยก db/backend/frontend พร้อม health checks
- GitHub Actions รัน backend tests, frontend lint, TypeScript และ build

## 5. Validation ล่าสุดที่รันจริง

Backend:

```powershell
cd backend
python -m pytest -q
```

- ผลล่าสุด: `24 passed`
- มี 9 warnings เดิมจาก `python-jose` ที่ยังใช้ `datetime.utcnow()` ภายใน dependency

Research tests:

```powershell
cd backend
python -m pytest tests/test_research_metrics.py -q
```

- ผลล่าสุด: `10 passed`

Frontend:

```powershell
cd frontend
npm run lint
npx tsc --noEmit -p tsconfig.app.json
```

- ทั้งสองคำสั่งผ่าน

Build:

- `npm run build` transform ผ่าน แต่ครั้งล่าสุดบน Windows ล้มที่การ unlink ไฟล์เก่าใน `frontend/dist/assets/` ด้วย `EPERM` เพราะไฟล์ถูก process อื่นล็อก
- `npx vite build --outDir dist-check` ผ่าน
- `frontend/dist-check/` ถูก commit อยู่ใน repository แล้ว ห้ามลบหรือเขียนทับโดยไม่ตรวจ diff และรับคำสั่งจากผู้ใช้
- Build ทางเลือกที่ผ่านไม่ได้พิสูจน์ว่า lock ใน `frontend/dist/` หายแล้ว ให้ลอง standard build ใหม่เมื่อ process ที่ใช้ `dist` ถูกปิด

ยังไม่ได้ยืนยันครบด้วย hardware/browser จริง:

- USB camera preview และ multi-camera load
- RTSP camera
- NVIDIA GPU throughput/memory
- 8-hour soak test
- SMTP delivery จริง
- PostgreSQL failure/recovery และ backup/restore drill
- Browser end-to-end flow
- Approved factory dataset และ locked model evaluation

## 6. Environment และวิธีรันที่ใช้ล่าสุด

ไฟล์ environment ที่ตรวจพบ:

- `backend/.env` มีอยู่และถูก Git ignore
- `frontend/.env.local` มีอยู่และถูก Git ignore
- root `.env` ยังไม่มี
- ห้ามอ่านหรือรายงานค่า secret โดยไม่จำเป็น
- ผู้ใช้เคยส่ง database password, bootstrap password และ bootstrap token ในแชทแล้ว ควรถือว่าค่าเหล่านั้นถูกเปิดเผยและ rotate ก่อน production หรือแชร์ repository/log

Backend บน Windows สำหรับ USB camera:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
alembic upgrade head
python -m pytest -q
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Frontend:

```powershell
cd frontend
npm run dev
```

ค่าที่ frontend ต้องมีใน `frontend/.env.local`:

```env
VITE_API_URL=http://localhost:8000/api/v1
```

Last observed runtime:

- Uvicorn start สำเร็จที่ port `8000`
- Admin bootstrap สำเร็จ
- หน้า API ใช้งานต่อกับ PostgreSQL local ได้
- เมื่อใช้ USB camera ให้รัน backend บน Windows host; Docker Desktop USB passthrough ไม่ได้ยืนยัน

## 7. Known issues และการตัดสินใจที่ยังค้าง

### 7.1 Retention warning แสดงซ้ำจำนวนมาก

ข้อความ:

```text
Refusing to delete evidence outside configured root: ...\backend\expired
```

Root cause ที่ตรวจพบ:

- หลังลบ original upload เก่า `retention_service` เปลี่ยน `Detection.original_image_path` เป็น sentinel string `"expired"`
- รอบ cleanup ถัดมา `Path("expired").resolve()` กลายเป็น `backend\expired`
- `_safe_unlink` เห็นว่าอยู่นอก `UPLOAD_DIR` จึงปฏิเสธอย่างถูกต้องและ log warning หนึ่งครั้งต่อ row
- Warning นี้ไม่ลบ `backend\expired` และไม่ทำให้ backend crash แต่สร้าง log noise ซ้ำทุก startup/retention cycle

งานถัดไปที่แนะนำ: เพิ่ม guard ให้ข้าม sentinel `"expired"` และเพิ่ม regression test โดยไม่เปลี่ยน schema

### 7.2 Stop กับ Disable ยังแทบเหมือนกัน

พฤติกรรมปัจจุบัน:

- Stop หยุด runtime และตั้ง `is_active=false`
- Disable endpoint ก็หยุด runtime และตั้ง `is_active=false`
- ไม่ได้ลบ camera row และยัง Start ใหม่ได้
- ประวัติ Detection/Event/Alert ยังคงอยู่

แนวทางที่เคยเสนอแต่ยังไม่ได้ implement:

- Stop = หยุดชั่วคราว
- Disable = soft archive/ซ่อนจากรายการใช้งาน แต่รักษาประวัติ
- Restore/Enable = นำกลับมาใช้งาน
- หลีกเลี่ยง hard delete เพราะ camera ถูกอ้างอิงจาก event/history

การทำให้ต่างกันจริงต้องเปลี่ยน database schema/migration และ public API จึงต้องถามผู้ใช้ก่อนลงมือ ตาม `AGENTS.md`

### 7.3 Detection evidence 404

- เคยพบ `GET /api/v1/detection/343/image/result` คืน `404`
- ตรวจพบว่า Detection `343` ไม่มี `result_image_path` และ `result_video_path`
- เป็นข้อมูลเก่าที่ไม่มี evidence ไม่ใช่ backend crash
- Frontend ยังอาจ request evidence ที่ไม่มีและลอง fallback ทำให้ console มี 404; ผู้ใช้ยอมรับว่าไม่กระทบในตอนนั้น จึงยังไม่ได้แก้

### 7.4 Docker image อาจรวม `.env`

- ยังไม่มี root `.dockerignore` หรือ `backend/.dockerignore`
- `backend/Dockerfile` ใช้ `COPY . .`
- เนื่องจาก build context คือ `./backend`, ไฟล์ `backend/.env` อาจถูก copy เข้า image
- ห้าม build/publish production image จนกว่าจะเพิ่ม `.dockerignore`, ตรวจ image contents และ rotate secrets
- การแก้ config/security นี้ต้องแจ้งผู้ใช้ก่อนตาม `AGENTS.md`

### 7.5 Model และ license

- Current model version: `sh17-yolov8s-baseline`
- `MODEL_LICENSE_APPROVED=false` ต้องคงไว้สำหรับ bundled SH17 checkpoint
- ห้ามขายหรืออ้าง production accuracy จาก SH17 checkpoint
- ต้องใช้ customer-owned, commissioned หรือ commercially licensed dataset/model สำหรับ commercial release
- ต้องตัดสิน Ultralytics AGPL/commercial license route และผ่าน legal review

## 8. Roadmap ที่เหลือ เรียงลำดับแนะนำ

### Phase A — ปิดบั๊กและทำ local pilot ให้เสถียร

1. แก้ retention sentinel warning พร้อม test
2. ตรวจ camera preview ด้วย USB จริง: Start, first frame, Stop, reconnect และ object URL cleanup
3. แก้ frontend missing-evidence 404 ให้ request เฉพาะ media ที่มี
4. ตัดสิน semantics ของ Disable; ขออนุมัติก่อน migration/API change
5. เพิ่ม `.dockerignore` และตรวจว่า image ไม่มี `.env`, uploads, datasets หรือ experiment artifacts; ขออนุมัติก่อน security/config change
6. เพิ่ม backend coverage สำหรับ camera lifecycle, events, retention, uploads และ failure paths
7. เสนอ frontend test framework ก่อนเพิ่ม dependency; ปัจจุบันยังไม่มี component/E2E test setup

### Phase B — สร้างหลักฐานสำหรับตีพิมพ์

1. ผ่าน `docs/pilot/DATA_APPROVAL_CHECKLIST.md` ก่อนเก็บข้อมูลโรงงาน
2. สร้าง dataset registry นอก Git พร้อม license/consent/retention records
3. Annotate `person`, `helmet`, `safety-vest` และ double-review อย่างน้อย 10%
4. Split 70/15/15 แยกตาม camera/day/site และ freeze locked test set
5. รัน SH17 baseline, factory fine-tune, temporal inference และ optimized edge model บน locked set เดียวกัน
6. ใช้ `evaluate_ppe.py` และ `evaluate_events.py` สร้าง auditable reports
7. รายงาน per-class metrics, event metrics, false alerts/missed events ต่อ camera-hour, confidence intervals และ failure slices
8. ห้าม tune threshold จาก locked test แล้วรายงานซ้ำเหมือนเป็น independent result

### Phase C — Field acceptance

1. ทดสอบ controlled scenarios ใน `ACCEPTANCE_TEST_PROTOCOL.md` อย่างน้อย 3 repetitions ต่อ camera
2. ทดสอบ 4 cameras ที่ 5 analyzed FPS บน target NVIDIA GPU
3. รัน 8-hour soak พร้อม `backend/scripts/pilot_monitor.py`
4. วัด p50/p95 alert latency, reconnect time, CPU/GPU/RAM/disk และ camera failures
5. ทดสอบ API restart, database interruption, SMTP unavailable และ disk pressure
6. ทดสอบผู้ใช้เป้าหมายอย่างน้อย 8 คน, task completion 90% และ SUS อย่างน้อย 75

Locked targets ปัจจุบัน:

- Event recall ≥ 90%
- Event precision ≥ 85%
- False alerts ≤ 1 ต่อ camera-hour
- Alert latency p95 ≤ 3 วินาที
- Camera reconnect ≤ 30 วินาที
- 4 cameras × 5 analyzed FPS
- 8 ชั่วโมงโดยไม่มี unhandled worker failure

### Phase D — Commercialization

1. Replace in-process camera runtime และ limiter ด้วย supervised workers + shared queue/state เช่น Redis ก่อน multi-instance
2. เพิ่ม organization/site isolation
3. เพิ่ม SSO/OIDC, least-privilege roles และ audit export
4. ทำ external penetration test, dependency/container scan และ SBOM
5. ทำ encrypted backup/restore, signed artifacts และ rollback drill
6. ผ่าน PDPA/privacy/legal review และ dataset/model/runtime licensing
7. กำหนด SLA/SLO, support ownership, observability retention, remote updates และ hardware BOM
8. ปิดทุกข้อใน `docs/pilot/COMMERCIALIZATION_GATE.md` ก่อนตั้ง `MODEL_LICENSE_APPROVED=true`

## 9. Next task ที่แนะนำสำหรับ session ถัดไป

เริ่มจากบั๊ก retention warning เพราะขอบเขตเล็ก ไม่ต้องเปลี่ยน schema/API/dependency และตรวจสอบได้ด้วย Pytest:

1. อ่าน `backend/app/services/retention_service.py`
2. เพิ่ม test ว่า path sentinel `"expired"` ถูกข้ามโดยไม่เรียก unlink และไม่ log warning
3. รักษาการป้องกัน path traversal/outside-root เดิม
4. รัน targeted test และ `python -m pytest -q`

หลังจากนั้นให้ผู้ใช้เลือกว่าจะทำ Disable soft archive หรือ Docker secret hardening ก่อน เพราะทั้งสองงานต้องมีการยืนยันตามข้อกำหนดใน `AGENTS.md`

## 10. Checklist สำหรับ Codex session ถัดไป

1. อ่าน `AGENTS.md` ทั้งหมด
2. อ่านไฟล์นี้ทั้งหมด
3. อ่าน `README.md` และเอกสารที่เกี่ยวข้องกับ task
4. รัน:

   ```powershell
   git status --short
   git log -3 --oneline --decorate
   ```

5. ถือ uncommitted changes ทั้งหมดเป็นงานของผู้ใช้จนกว่าจะพิสูจน์ได้ว่าเป็นของ task ปัจจุบัน
6. แสดงแผนสั้น ๆ ก่อนแก้ แต่ทำต่อได้ทันทีหากไม่เข้าเงื่อนไขที่ต้องถาม
7. ต้องถามก่อน schema/migration, dependency, public API, authentication/authorization, deletion, retention/privacy, security หรือ production config change
8. ห้าม commit, push, reset, checkout, revert หรือลบ `dist-check` โดยไม่ได้รับคำสั่ง
9. รัน test/validation จริงและรายงานตามผล ห้ามอ้าง production-ready หรือ accuracy โดยไม่มีหลักฐาน
10. เมื่อจบ task สำคัญ ให้อัปเดต Snapshot, Completed work, Validation, Known issues และ Next task ในไฟล์นี้ โดยห้ามบันทึก secret
