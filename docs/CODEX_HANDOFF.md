# Codex Handoff — PPE Guard AI

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
                                                        └── blurred evidence/preview
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
- Preview เป็น JPEG ลดขนาดสูงสุด 960 px และ update ประมาณทุก 0.5 วินาที
- Frontend poll ประมาณทุก 750 ms
- เก็บ preview ใน memory เท่านั้น ไม่บันทึกลงดิสก์
- ใช้ annotated frame ที่ผ่าน best-effort head/face blur
- ต้องทดสอบกับ USB/RTSP hardware จริงอีกครั้ง การ blur ไม่ใช่การรับประกัน anonymization

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
