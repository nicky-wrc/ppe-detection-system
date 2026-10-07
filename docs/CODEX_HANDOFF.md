# Codex Handoff — PPE Guard AI

## Same-project isolated demo schema — 2026-10-06

- User explicitly approved reusing the existing Supabase project with a separate
  schema, after the free-project quota prevented a new project. This supersedes
  the earlier NEW-project requirement. No automatic commit/push is authorized.
- Added DATABASE_SCHEMA / DATABASE_ROLE and a shared PostgreSQL connection guard
  used by both ORM and Alembic. Research demo now requires `ppe_demo` / `ppe_demo_app`
  and TLS. On every checkout restore search_path without public fallback, check
  actual login, role flags/memberships, owner and effective permissions. Reject
  outside app data access, CREATE outside scope and demo Data API schema access.
- Built-in catalogs/statistics are not private application data. Supabase grants
  PUBLIC SELECT on two pg_stat_statements views; only genuine extension-owned
  views are exempted (PostgreSQL protects other roles' query text). Integration
  verifies a spoofed view name cannot bypass the guard. Never allow elevated role
  memberships or give Render the old project's broad service-role Storage key.
- Updated Blueprint/env example/guide; `render_start.py` verifies DB scope before
  downloads/migrations. Alembic reflections and version table target demo schema;
  offline isolated migrations rejected. No new table definition or public revision
  change: existing migrations initialize the new schema only.
- Additive preparation script uses existing private operator .env, generates a
  separate demo password and exclusively saves its connection outside Git. It
  refuses collisions/unsafe grants and compares old public layout/ACL/counts/version
  before/after. Managed non-superuser PostgreSQL 16+ role creation temporarily uses
  SET on the new role for DDL, then revokes SET and leaves INHERIT false.
- Actual provisioning and ONLINE demo migration completed in approved project
  wjnlwekpfiveihrzchlh. Twelve demo tables including separate Alembic version at
  `20260929_01`; demo users zero. Old public snapshots identical, `.env` unchanged.
  First failed attempts rolled back fully; no old ACL revokes/data deletions.
- Verified actual role identity `ppe_demo_app`, schema `ppe_demo`, client TLS true.
  Generated connection is in ACL-restricted private-backups/render-demo-schema-20261006/
  render-demo.env, current Windows user and SYSTEM only. NEVER print or commit it.
  Do not rerun provisioning: existing role/schema should cause refusal.
- Tests: full isolated SQLite backend suite 176 passed / 67 existing JWT warnings;
  local PostgreSQL 17 integration (separate cluster) passes migration idempotence,
  version/accounts isolation, old public reads/writes denied, public preservation,
  pool rollback/recheckout scoping, unsafe grants/admin login/spoofed view rejection.
  Non-superuser operator scenario included. Test clusters retained outside Git and
  stopped after validation. No GPU/camera/inference or Docker/Render acceptance.
- GitHub main already held commit 70c0cdd at task start; new schema-aware changes
  remain uncommitted. Render Blueprint form previously selected repo/main, but the
  services are NOT deployed. Next user reviews/pushes changes, then uses NEW demo
  connection in Render, privately supplies model URLs and new bootstrap account.


## Deployment preparation and active model audit — 2026-10-04

- User asked to prepare deployment and audit newest YOLOv8/YOLO11 models; no provider/domain chosen or public deployment performed. Existing local frontend/backend processes and private Supabase .env unchanged this turn.
- Authenticated read-only active-model endpoint reports `orange-ppe-yolov8m-yolo11n-hybrid-20260917-v4`, best.pt and yolo11n.pt available. Existing bootstrap login used without logging credentials/tokens; login endpoint does not mutate accounts.
- Configured v4 checkpoint SHA-256 matches training report `833fa3362afad19f27ff68ac44a52e598d26bd96f7f9f750b5469bd2382e0b9c`. YOLO11n SHA-256 `0ebbc80d4a7680d14987a577cd21342b65ecfd94632bd9a8da63ae6417644ee1`; it is existing pretrained person assist, not a newly fine-tuned YOLO11.
- Running backend PID uses guarded run_local.py with --disable-wmi; separate check-only model load confirms CUDA:0, crop refinement true, low-light enhancement true, cleanup false. No new inference/camera run; API model metadata is configured settings, not an in-memory fingerprint.
- v4 is latest successful local fine-tune, not best on every metric. Orange-like vest F1 75.17→76.06, helmet 84.76→84.79; full-test helmet F1 85.67→85.10. No new target-camera accuracy claim or license approval.
- Added root/backend/frontend .dockerignore; service contexts source allowlists exclude env, venv, checkpoint/data/evidence files. Backend image now needs explicitly supplied runtime model mounts. Root guard handles accidental root contexts.
- Frontend Dockerfile uses npm ci and build-time PUBLIC VITE_API_URL; no dependencies upgraded. README corrected model/test database notes and links new docs/DEPLOYMENT_PREPARATION.md.
- Added deployment-asset regression tests. Focused tests 7 passed; full backend isolated SQLite suite 117 passed, 1 failed, 44 warnings. Failure reproduced alone: Viewer daily analytics ZoneInfoNotFoundError Asia/Bangkok, due to absent IANA timezone DB in Windows venv; backend application code and requirements unchanged by preparation.
- Live read-only /health healthy, /ready database ok, Stats 200, daily analytics 500. Proposed tzdata dependency requires explicit approval under AGENTS.md; NOT added/installed or worked around.
- Frontend lint zero errors/two existing CameraPage hook warnings; app TypeScript passed; isolated Vite production build with placeholder public API URL passed outside repo at private-backups/deployment-check-20261004/frontend-dist. Local dist not replaced.
- Docker CLI exists but Linux daemon unavailable; Docker build/context enforcement/image contents NOT verified. Actual hosted browser/HTTPS/CORS/WebSocket/GPU/storage tests remain pending.
- Blockers: approve timezone dependency, select hosting/architecture/domain, license/privacy gate (MODEL_LICENSE_APPROVED=false preserved), shared-media path migration if moving host, one native-camera runtime owner. Existing Compose overrides Supabase URL to local db; do not use unchanged for cloud.
- No secrets in Git, no model/.env/data deletion, no commit/push or public deployment.

## Supabase permissions and local configuration cutover — 2026-10-04

- User authorized revoking Data API grants and changing backend connection. Transactionally revoked ALL privileges on the 12 migrated public app tables and their sequences from anon/authenticated/PUBLIC. Verified both roles have no inherited effective table/sequence privileges; postgres access and counts unchanged.
- Applied schema-scoped postgres default-privilege revokes for future public tables/sequences; no RLS, app-role permissions, schema/model changes or Data API dashboard toggles. Existing permissions snapshot retained privately as `permissions-before-cutover.json`; do not equate this with verifying Dashboard Data API disabled.
- Changed ONLY `DATABASE_URL` in ignored `backend/.env` using apply_patch, password URL-encoded and `sslmode=require`. Other parsed environment values unchanged, including model and `EVIDENCE_RETENTION_ENABLED=false`.
- Prior complete `.env` retained in ACL-restricted private folder as `backend.env.before-supabase` for rollback. Contains secrets: never print, commit or share publicly. Private `cutover-result.json` records sanitized verification.
- Actual backend Settings/SQLAlchemy engine connected read-only to intended project; all 12 table counts match and effective anon/authenticated grants absent. Verified client-to-pooler TLS through psycopg2 connection info.
- Initial TLS audit incorrectly used pg_stat_ssl (pooler-to-Postgres leg) and returned false; corrected to actual driver ssl_in_use and verification passed. No data/schema mutation occurred in verification.
- No port 8000 listener observed; did NOT launch app lifespan, cameras, inference, bootstrap or cleanup. User should run existing `run_local.py --disable-wmi` to test UI/login/camera. No end-to-end UI test performed.
- Original local DB/uploads/models and both private backups preserved. Media NOT uploaded: current Windows backend can use local evidence; another machine needs shared backend or a separately reviewed media migration. Use only one owner for native-camera runtime.
- Rollback requires stopping backend and restoring previous local connection; new Supabase writes do not automatically sync back to old local DB. No commit/push performed.

## Supabase import completed, cutover pending — 2026-10-04

- User explicitly approved starting cloud import and supplied password in a private local file (never logged). TLS-required connection to approved Singapore session-pooler project succeeded; target PostgreSQL 17.11 public tables/views/sequences were empty before restore.
- Fresh backup retained outside Git at `D:\ppe-detection-system\private-backups\supabase-import-20261004-02`; 182 media files/601091690 bytes hash verified. Archive SHA-256 `e69010ac45582a64440a09842885a3b67ffd579ba94c230aeabaef22e17a2231`.
- Transactional `pg_restore --no-owner --no-acl --exit-on-error --single-transaction` succeeded. All 12 table counts match source, no unvalidated public constraints; Alembic revision `20260729_01` preserved. Report `supabase-import-result.json` in private backup folder.
- Source DB, uploads/models and backend `.env` unchanged; no app/camera start. Media was NOT uploaded. Native-camera multi-backend ownership/local Windows media paths remain constraints.
- SECURITY FINDING: read-only `has_table_privilege` audit found anon and authenticated each have at least one CRUD privilege on all 12 app tables (24 role/table pairs). This does not establish that Data API is enabled or data exposed; its state has not been verified. Do not assert Data API is off based on the user's following earlier recommendations.
- Pause cutover pending user approval to remove Data API role grants / verify Data API disabled. Existing backend auth uses direct PostgreSQL and its own JWT, not Supabase Auth. Do not change role grants, RLS or backend connection until authorized under AGENTS.md.
- Private credential file retained in ACL-restricted backup directory as user-entered; never print/commit its contents. No new repository code changes or commit/push.

## Local backup and Supabase preparation — 2026-10-04

- User authorized backup/preparation, not connection cutover or cloud upload yet.
- Private backup outside Git: `D:\ppe-detection-system\private-backups\supabase-prep-20261004-01`.
- PostgreSQL 17.5 source `ppe_detection`; pg_dump 17 custom archive (106850 bytes), exported read-only snapshot shared with row-count audit. Source untouched.
- Archive SHA-256: `20195492e504c56e290fdf40bda246ba9e8ca615ecd8cec0058362a40272b99a`.
- Restored into newly created local `ppe_restore_verify_20261004_01`; all 12 table counts match and constraints validated. Verification DB retained, no DROP/cleanup.
- Counts: users 8, detections 428, alerts 599, cameras 3, violation_logs 82, user_settings 4, alembic_version 1; remaining 5 tables empty.
- Copied 182 media files, 601091690 bytes; each source/copy SHA-256 checked. No API listener on port 8000 observed, but final cutover must stop all writers and refresh backup if changed.
- Folder ACL restricted to current user and SYSTEM; archive/media not encrypted and must not be committed/shared publicly. No credentials logged or copied into Git.
- `.env` hash unchanged; no model/settings/schema/runtime edits, cloud connection or upload. Backup scripts avoid app imports/lifespan.
- Private `NEXT_STEPS.md` covers target preflight, no destructive restore flags, count/constraint verification, one camera runtime owner, local-media limitations and rollback.
- Next: user enters Supabase password locally, approves remote import of metadata; inspect empty target before transactional restore. Do not ask for password in chat. Preserve all source data and disabled cleanup.

## CPU crop refinement opt-in — 2026-09-24

- Friend's Mac loads the September 17 candidate but MPS reports unavailable in both environments. Added `PPE_CROP_REFINEMENT_ON_CPU=false` default; set true together with `PPE_CROP_REFINEMENT=true` to use the existing crop inference on CPU. CUDA/MPS behavior and device selection unchanged. Existing `PPE_CROP_MAX_PERSONS` limits work; README provides a one-person, 2 analysis FPS starting configuration for the Mac.
- No .env, weights, dependencies, database schema or API changes; no commit/push. Friend needs this code update before using the new option. CPU is slower; this change does not establish orange-PPE accuracy or Mac performance.
- Validation: detector/launcher tests 27 passed, including CPU opt-in/off, master switch, CUDA/MPS regression and crop-person limit. Real September 17 weights ran a synthetic one-person crop through CPU inference on Windows (~0.569 seconds, no detections); no camera or media files used for that smoke test. Mac/webcam not tested.
- Extended Settings suite has 5 existing failures (sensitivity clamp expectations, detector mock missing names, API rejects old sensitivity value). Reproduced the same five with the HEAD detector loaded in memory after isolated test configuration; unrelated to CPU crop change. An initial baseline attempt imported app config too early and hit the local app lifespan/login instead of the test DB (401); cleanup was disabled and no cameras were started explicitly. Corrected baseline initialized test configuration first.

## Session update — orange PPE 5,000-image fine-tune (2026-09-17)

- User reported weak real-camera orange hardhat/vest detection and requested about 5,000 training images. Created a deterministic public-data selection: 5,000 unique train images = 1,237 orange-like vest, 3,263 orange-like helmet, 500 no-helmet/no-vest negatives. HSV selection is not human color truth and may include skin/background/warm yellow. Locked val/test unchanged.
- Added `scripts/select_orange_training.py`, tests, and configurable `--hsv-s/--hsv-v` training options. Materialized v2 view uses 19,712 hard links (0 copies) to isolate Ultralytics cache without duplicating image data or changing source files.
- First run `orange-ppe-yolo8m-20260917-v3` stopped before epoch 1 because the existing train cache was Windows-locked. It was preserved. Successful v4 trained all 15 epochs on RTX 4070 from the 20260909-v2 candidate; best validation checkpoint came from epoch 11.
- New candidate: `backend/experiments/orange-ppe-yolo8m-20260917-v4/weights/best.pt`, 52,044,626 bytes, SHA-256 `833fa3362afad19f27ff68ac44a52e598d26bd96f7f9f750b5469bd2382e0b9c`. Existing candidate, baseline, local `.env`, DB/uploads/evidence and retention config remain unchanged. App model was not switched.
- Locked public test: helmet AP50 89.43→89.82, AP50-95 58.51→58.57; vest AP50 84.88→85.12, AP50-95 56.38→55.97. At conf 0.20 on the 772-image orange-like slice: helmet F1 84.76→84.79 (recall up, precision down); vest F1 75.17→76.06 (precision up, recall down). Improvement is modest and does not prove target-camera accuracy.
- Separate orange-slice Ultralytics evaluation hit the same locked source test cache; no cache was deleted. Fixed-threshold slice scoring instead reused full locked-test predictions and the identical frozen image list, which is sufficient for TP/FP/FN comparison. Details: `backend/mlops/ORANGE_PPE_RESULTS_20260917.md`.
- Next meaningful step: obtain approved, human-labeled target-camera orange PPE and orange-decoy images split by camera/date. Do not promote v4 merely from public HSV metrics; compare it with v2 on the user's real staged clips first. Keep `MODEL_LICENSE_APPROVED=false`.

## Session update — Settings applied to runtime (2026-09-09)

- Scope: make the existing Settings controls take effect without changing database schema, public API, RBAC, model artifacts, local `.env`, or retention policy. Worktree was clean at the start. No commit/push or application/camera startup performed.
- Root causes: native camera runtime ignored personal `active_ppe_rules`; empty required-PPE lists fell back to helmet + vest in both option resolution and detector. Added shared `detection_preferences.py` for camera/upload/frame resolution, preserving camera-owner settings and active-zone precedence. Explicitly empty zone rules or both personal rules disabled now suppress PPE violations while retaining person detection. Legacy absent settings retain defaults.
- Runtime queries refresh preference/zone ORM rows and reread each frame. Changing effective rules/thresholds resets temporal confirmation so frames evaluated under previous settings cannot confirm a new event. Disabling native camera evidence clears only in-memory pending clips/buffers; saved media and metadata are not deleted.
- Frontend now distinguishes draft/saved values, disables redundant save, supports discard, warns on tab close/reload, explains confidence/sensitivity, marks zone edits as immediate shared changes, and distinguishes zone-load failure from empty data. Model information comes from the existing API rather than hardcoded healthy/version labels.
- Settings service publishes successful saves and refreshes subscriptions on same-origin storage events/window focus. Layout and browser-camera audio follow saved values; camera audio uses a ref so sound updates do not restart the browser capture stream. Metadata remains in the database; browser storage contains only a revision notification.
- Explicit existing limitation: `save_evidence` covers native/backend camera snapshots and clips, not uploaded images/videos or browser fallback using the upload API. This is stated prominently in Settings and README; changing that upload/privacy contract requires user confirmation. Native cameras use owner preferences, while browser/upload calls use the logged-in actor. No global settings or new role permissions introduced.
- Validation: backend full suite `103 passed, 67 warnings` (python-jose UTC deprecation); frontend ESLint has 0 errors and the same 2 CameraPage hook warnings verified against HEAD; TypeScript passed; production build passed into a unique OS-temp directory. Default `npm run build` could not replace a locked existing `frontend/dist/assets/AdminUsersPage-6EUeln3d.js` (EPERM); did not force-unlock/delete the old output. Settings service smoke checks with Node/TypeScript and mocked APIs/events passed loading, saved notification, cross-tab refresh, failures, account isolation, cleanup and legacy normalization.
- Not validated: real browser + webcam/speaker, concurrent live GPU inference, PostgreSQL integration. Next manual check: restart backend with `.\\.venv\\Scripts\\python.exe run_local.py --disable-wmi`, refresh frontend, open Settings and Detect in two tabs with the camera-owner account, save changed thresholds/rules, verify zone precedence and audio. Test evidence-off only on native capture. Keep `EVIDENCE_RETENTION_ENABLED=false` and all existing files/data.

## Follow-up — local camera activation requested (2026-09-09)

- User explicitly requested switching the local website/backend to the fine-tuned model for their staged camera test.
- Changed only `backend/.env` MODEL_PATH to `./experiments/orange-ppe-yolo8m-20260909-v2/weights/best.pt` and MODEL_VERSION to `orange-ppe-yolov8m-yolo11n-hybrid-20260909-v2`. Kept person assist, thresholds, privacy settings and MODEL_LICENSE_APPROVED=false unchanged. Original weights preserved.
- Real in-memory hybrid smoke test loaded the exact configured candidate (no baseline fallback), retained `yolo11n.pt`, used CUDA device 0 and processed a synthetic blank frame successfully. No camera capture or evidence was created.
- Local Python 3.12.2 hangs in `platform._wmi_query` while importing Torch and SQLAlchemy (faulthandler verified). Added `backend/run_local.py --disable-wmi`: opt-in process-local CPython non-WMI fallback before third-party imports; no Windows service or global Python changes. The launcher loads the backend `.env`, verifies the exact PPE/person model paths (refuses fallback), then starts one Uvicorn process. `--check` loads models only, without API/camera startup.
- IMPORTANT: backend/frontend were not running. Before starting the backend, a read-only retention audit found 164 existing files eligible for immediate startup cleanup under the current 30-day policy (428 old Detection rows, 82 old Event rows). All cameras are inactive (3 registered). No files were deleted and the backend was deliberately not started.
- User subsequently explicitly requested preserving all existing data and asked for commands to start both servers themselves. Added `EVIDENCE_RETENTION_ENABLED` (default true for existing deployments) and set only local `backend/.env` to false. Both the cleanup loop and direct purge return before any DB access/deletion when disabled. Existing age limits remain unchanged; do not re-enable cleanup without the user's approval.
- No API/frontend server or physical camera was started by the agent. `run_local.py --disable-wmi --check` verified candidate `best.pt`, `yolo11n.pt`, `cuda:0`, and `evidence_cleanup_enabled=false`. Tests use explicit model/retention environment values so local `.env` changes do not alter test expectations.
- The local launcher also refuses API startup if cleanup is enabled, including an overriding environment variable; check-only mode remains non-mutating. This is an extra preservation guard for the user's local trial.
- Validation after these changes: backend `95 passed, 63 warnings` (existing python-jose UTC deprecation), launcher check-only confirmed CUDA/new model/cleanup false, and `git diff --check` passed. Original baseline SHA-256 is unchanged. No servers were started; the user will run the commands below.
- User commands: from `backend`, `.\.venv\Scripts\python.exe run_local.py --disable-wmi`; from `frontend`, `npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort`. Open `http://localhost:5173/detect`; PostgreSQL must be running. Data/model originals remain untouched.

## Session update — 2026-09-09 (Orange PPE fine-tuning)

- Scope: improve helmet/reflective-vest detection using an isolated public-data experiment; do not change the deployed model, `.env`, model-license approval or user data.
- Run: `backend/experiments/orange-ppe-yolo8m-20260909-v2`; guide and reproduction commands: `backend/mlops/ORANGE_PPE_TRAINING.md`.
- Snapshot: completed 20 epochs and baseline/candidate test evaluation at 19:17:16 Asia/Bangkok. Report: `backend/mlops/ORANGE_PPE_RESULTS_20260909.md`. Job status is `completed`; no training process needs resuming.
- The first process stopped during epoch 11 validation without a traceback. Resumed from completed epoch 10 at 18:48:59 Asia/Bangkok; original logs preserved as `training.log`, continuation in `training_resume_1.log`.
- Dataset: HardHat-Vest v3 public source, 22,141 original images. Excluded conflicting duplicate groups and exact cross-split repeats from generated views only; source preserved. Prepared 22,070 images; selected 6,676 train images including all 3,088 vest-positive training images. Validation/test remain 2,415/2,441 images.
- Class mapping retains SH17 IDs. There are NO person labels, despite person being declared by the source. Class-name compatibility is not evidence of preserved person capability. Do not promote the candidate automatically.
- Training uses the CUDA `.venv`, not CPU-only `.venv312`: YOLOv8m, RTX 4070, imgsz 640, batch 16, workers 0, freeze 10, AdamW 0.0003. `workers=0` addresses the previous Windows multi-worker memory failure.
- Added conversion/deduplication tests, focused selection and its tests, resumable experiment supervisor and tests, orange-like test slice and tests, fixed-confidence scorer and tests. Corrected selection hash to actual CRLF file bytes while retaining the old normalized-LF digest; training membership was unchanged.
- Validation: backend `88 passed, 63 warnings` (existing python-jose UTC deprecation); compile checks and `git diff --check` passed. No frontend/runtime/API changes in this task.
- Known limits: source splits can share related scenes; labels are not color ground truth and may be incomplete; publisher lists CC0 but the archive aggregates sources and includes no license file; initial SH17 weights remain research-only. The 772-image HSV slice is exploratory and includes background/skin colors, not an independent orange-PPE benchmark.
- Results: public-test AP50 helmet 35.54% → 89.43%, vest 51.84% → 84.88%. At fixed confidence 0.20, vest recall rose 41.89% → 88.08%, but precision fell 73.03% → 62.64% and FP rose 144 → 489. Fixed-threshold full-test and HSV-slice reports are preserved in the job directory; these are raw frame scores, not hybrid/event metrics.
- Candidate: `...v2/weights/best.pt`, 52,045,266 bytes, SHA-256 `582e6bedff94f5bdf2d0602bd77aa432039617bae802e4a4f9cfc5745c899d05`. Original `yolo8m.pt` hash remains `085631758e8e1993159c356b01b5d8b5628cd21e577450b4d3c399d519be4dda`.
- Next: obtain approved target-camera labels for person/helmet/vest and negative orange clothing, calibrate thresholds on validation and check person regression plus hybrid/event behavior before considering runtime promotion. Do not tune from this reported test set or automatically change `.env`.
- Git: source/docs only; datasets, runs and checkpoints remain ignored. No commit/push, deletion or overwrite of original weights performed.

## Follow-up — Detection Video black-screen fix (2026-07-31)

- Root cause มีสองชั้น: `DetectionPage` ซ่อน `<video>` แล้วแสดง canvas เปล่าที่ไม่มีทางเริ่มเล่น และ backend เขียน annotated MP4 ด้วย `mp4v/FMP4` ซึ่งไฟล์ล่าสุดยืนยันว่า Chrome/Edge มักถอดรหัสไม่ได้ แม้ input เดิมเป็น H.264
- หน้า Video เปลี่ยนเป็น native `<video controls>` ที่แสดงไฟล์ต้นฉบับทันที หลังประมวลผลจะโหลด protected result ผ่าน Axios/JWT เป็น Blob URL และเปลี่ยนไปเล่น annotated result; ถ้าผลลัพธ์หรือ codec เล่นไม่ได้จะย้อนกลับไปแสดงต้นฉบับพร้อมข้อความแทนจอดำ
- Blob URL ของ preview/result ถูก revoke เมื่อเปลี่ยนไฟล์หรือออกจากหน้า และการเล่น uploaded video ไม่เรียก live-frame detection อีก จึงไม่สร้าง Detection/Alert ซ้ำกับ file-processing flow
- `PPEDetector.process_video` เลือก browser-compatible H.264 (`avc1`) และ fallback เป็น VP8 WebM แทน `mp4v`; ถ้า runtime ไม่มี encoder ที่รองรับจะเก็บ best annotated frame และ frontend ยังแสดงวิดีโอต้นฉบับ
- เพิ่ม regression test สำหรับ H.264 → WebM writer fallback; targeted detector tests ผ่าน `16 passed`, backend full suite ผ่าน `47 passed` พร้อม 9 `python-jose` warnings เดิม, frontend ESLint/TypeScript และ isolated Vite build ผ่าน
- Codec smoke test บนเครื่องนี้เขียน H.264 ได้ 10/10 เฟรม แต่ dev servers ไม่ได้เปิดตอนจบงาน จึงยังไม่ได้ทำ authenticated browser E2E ด้วยไฟล์ผู้ใช้หลังแก้

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

## Deployment snapshot — 2026-10-06

- User requested implementation to prepare a free deployment. Target: Render
  Free controlled invited academic demo, then the existing `dtech.life` domain.
- Added `render.yaml`, `backend/Dockerfile.render`, `requirements-cpu.txt`, strict
  `render_start.py` and `docs/RENDER_FREE_DEPLOYMENT.md`.
- Exact September 17 v4 PPE and existing pretrained YOLO11n person checkpoints
  are hash-verified at startup; downloaded privately, not placed in Git/images.
- New explicitly acknowledged `research_demo` environment requires a separate
  database confirmation. Invited browser webcam frames are stateless/serialized;
  native cameras, persistent detection uploads, metrics and API docs are disabled.
  Regular local development and the production license gate remain unchanged.
- Added demo `/detect` UI behind `VITE_RESEARCH_DEMO=true`, with consent/start/stop,
  USB/webcam selection, serial requests and PPE overlays. No tenant isolation or
  cloud access to factory-local RTSP is implemented by this demo.
- Pinned/installed `tzdata==2026.5`; fixed Alembic percent interpolation. No schema
  migration was run against the original database. Existing `.env`, data, media,
  model checkpoints and private backups were preserved.
- Validation: full isolated backend suite 147 passed / 67 warnings; frontend
  lint zero errors / two existing warnings, typecheck and isolated demo build pass.
  Docker Desktop Linux daemon unavailable; hosted RAM/cold starts/camera untested.
  Local backend not running during latest read-only API check, so no live API fix
  verification is claimed. Free Render memory may be insufficient for this pair.
- No commit/push, external deployment, paid resource or DNS change made.
- Next: user reviews/pushes changes, authorizes Render repository access, creates
  separate demo Supabase DB and private artifact downloads, then deploys/tests.
  Keep all credentials in hosting secrets, not chat/Git/frontend. Do not send a
  tester URL until actual hosted acceptance succeeds; never silently change model.

## 10. Checklist สำหรับ Codex session ถัดไป

### 2026-10-07 hosted memory incident and CORS repair

- Render Events confirmed instance h7lvj failed at 18:02 Bangkok: RAM above 512 MB.
  Public health returned 502. Proxy errors have no application CORS headers; this
  is distinct from native-camera preflight being rejected by the demo boundary.
- Moved configured CORS middleware outside request/demo middleware. Preflight is
  handled, while actual native-camera access remains 403. Unapproved origins stay
  rejected; no wildcard, role, consent, evidence or database policy was changed.
- Free Blueprint uses inference size 320, crop refinement off (including CPU opt-in),
  preserving v4/YOLO11n weights. User authorized these changes. Render environment
  was saved with the same three overrides and a service restart requested. Local
  `.env`, original data/media and checkpoints are unchanged; no paid resources.
- Then manually deployed existing b561e07 to apply saved environment reliably:
  dep-db32lgrbc2fs73cdkt60 went Live at 18:21 Bangkok. New instance 2q7lq started;
  the source CORS repair still requires a separate user push/deployment.
- Validation: research_demo, cloud_evidence and frame_responsiveness tests: 54 passed;
  API security, roles and settings regression: 15 passed (53 existing JWT warnings
  across both runs). After restart, public /health and /ready returned 200 with
  database ok and cloud recording still enabled; Render reported service recovered.
  Hosted frame inference/peak memory remains
  unverified; smaller inputs may reduce distant-PPE recall.
- CORS source changes are NOT committed/pushed or deployed yet. User must push or
  explicitly authorize Git writes before deployment. Check restart/health, then
  actual consented camera persistence and resource use before declaring success.

### 2026-10-07 cloud feature parity work (pending hosted setup)

- Hosted CPU/free demo is not equivalent to localhost. Existing research-demo
  restrictions and model/license gates remain active; v4 weights unchanged.
- Added opt-in consented browser-frame metadata recording using existing demo
  tables, recording mode/cooldown, optional blurred JPEG private Storage, and
  authenticated evidence proxy. Added fail-closed config and public-key-only
  Storage client using a dedicated Auth identity (not service_role).
- Defaults remain off. No Storage bucket/account/policy created, Render environment
  changed, original DB/media deleted, local `.env` edited, commit/push performed.
- See `docs/CLOUD_BROWSER_RECORDING.md` for provisioning gate, policy audit and
  outstanding gaps. Do not claim full parity or persistence until actual hosted
  acceptance testing. Auth credentials must be entered privately by the user.
- Validation: targeted backend 60 passed (45 existing JWT deprecation warnings);
  includes private storage mocks, consent/settings/cooldown, head blur before
  upload and isolated database persistence across sessions. TypeScript and
  isolated Vite build passed; lint zero errors, two existing CameraPage warnings.
- Next: review/retest final changes; obtain confirmation for private evidence
  bucket and dedicated identity provisioning; audit existing RLS before enabling.
  Real browser camera/roles/restart persistence still unverified for this feature.

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
