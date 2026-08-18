# PPE Guard AI

Edge-first PPE monitoring for factories. The pilot detects people, helmets, and safety vests from uploaded media or 2–4 USB cameras, confirms violations across multiple frames, records privacy-filtered evidence, and supports alert review and reporting.

## Architecture

```text
React/Vite UI ─────── FastAPI ─────── PostgreSQL
       │                 │
       └── WebSocket ────┤
                         └── Camera runtime ── YOLO SH17 ── temporal confirmation
                                              │
                                              └── blurred snapshot + event clip
```

The camera runtime currently runs in the API process for a single-edge pilot. Before adding multiple API replicas, move runtime coordination and rate-limit state to a dedicated worker with Redis.

## Pilot capabilities

- JWT authentication with `admin`, `safety_officer`, and `viewer` roles
- Image, video-frame, and file-based detection
- Registered USB cameras with test/start/stop/health controls
- Per-zone helmet and safety-vest rules
- Violation confirmation when a tracked person is non-compliant in 4 of 5 analyzed frames
- Duplicate-event cooldown, real-time WebSocket alerts, SMTP delivery with retry
- Face/head blurring before snapshot or clip persistence
- 5-second pre-event and 10-second post-event evidence clips
- 30-day evidence cleanup, protected media endpoints, audit-ready event statuses
- Dashboard analytics, history, PDF/CSV reporting, user and settings management
- Alembic migrations, backend tests, frontend lint/type checks, and Docker health checks

## Prerequisites

- Python 3.10–3.12
- Node.js 20+
- PostgreSQL 15+
- NVIDIA GPU with 8 GB+ recommended for 2–4 cameras
- Two to four USB cameras for the pilot

Do not collect factory images until written approval, privacy notice, access control, and retention rules are complete. See `docs/pilot/DATA_APPROVAL_CHECKLIST.md`.

## Configuration

Copy `.env.example` to `.env` and replace every placeholder secret. For local backend development, change `DATABASE_URL` host from `db` to `localhost`.

Production startup rejects the development secret and requires `AUTO_CREATE_TABLES=false`. The first administrator is created only when both `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` are explicitly configured. Remove the bootstrap password after the account is created.

## Local development

Backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# Windows + NVIDIA GPU (tested on RTX 4070 / CUDA 12.8):
pip install -r requirements-gpu.txt
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Frontend:

```powershell
cd frontend
npm ci
npm run dev
```

`requirements-gpu.txt` pins the reviewed Windows CUDA 12.8 build. Skip that second install on CPU-only hosts; the detector falls back to CPU and automatically disables person-crop refinement to protect latency. Confirm the selected runtime with `python -c "import torch; print(torch.cuda.is_available())"` before a camera pilot.

- UI: `http://localhost:5173`
- API docs in development: `http://localhost:8000/docs`
- Liveness: `http://localhost:8000/health`
- Readiness: `http://localhost:8000/ready`
- Prometheus-format pilot metrics: `http://localhost:8000/metrics`

Run the backend natively when accessing USB cameras. Passing USB devices into Docker Desktop is platform-specific. Docker Compose remains suitable for database, API validation, and deployments where camera devices are exposed to the container host. On macOS, grant Camera permission to the app that launches the backend, such as Terminal, iTerm, VS Code, or Python. If permission was denied earlier, run `tccutil reset Camera`, restart the launcher app, start the backend again, and approve the camera prompt.

## Docker deployment

```powershell
Copy-Item .env.example .env
# Edit .env and replace database password, JWT secret, and bootstrap credentials.
docker compose up --build
```

The backend container applies `alembic upgrade head` before starting. Never expose PostgreSQL, metrics, or camera streams directly to an untrusted network.

## Verification

```powershell
cd backend
python -m pytest -q

cd ..\frontend
npm run lint
npx tsc -b --pretty false
npm run build
```

## Model training and evaluation

The repository contains SH17 checkpoints. The runtime currently uses `yolo8m.pt` for PPE, `yolo11n.pt` for person assistance, person-crop refinement on CUDA, and conditional low-light enhancement. This hybrid remains a research baseline until evaluated on an approved target dataset. Private datasets and experiment outputs are ignored by Git.

```powershell
cd backend
Copy-Item mlops\ppe_factory.example.yaml mlops\ppe_factory.yaml
python -m app.ml.train_ppe --data mlops/ppe_factory.yaml --model yolo8s.pt --name factory-yolo8s-v1
python -m app.ml.evaluate_ppe --data mlops/ppe_factory.yaml --model experiments/factory-yolo8s-v1/weights/best.pt --split test --output experiments/factory-yolo8s-v1/test_metrics.json
```

Dataset splitting, annotation review, baselines, and required metrics are defined in `backend/mlops/README.md`. Do not claim production accuracy from training metrics or adjacent video frames randomly split across train and test.

The bundled SH17 checkpoints are research baselines and are blocked from production by default. Before setting `MODEL_LICENSE_APPROVED=true`, replace them with a model trained from commercially permitted data and complete `docs/pilot/COMMERCIALIZATION_GATE.md`. This flag is a deployment assertion, not a substitute for legal review.

## Main API groups

- `/api/v1/auth` — login, profile, controlled bootstrap
- `/api/v1/admin/users` — role and account management
- `/api/v1/cameras` — camera registration and runtime control
- `/api/v1/events` — confirmed violation events and protected evidence
- `/api/v1/detection` — upload, history, statistics, and analytics
- `/api/v1/alerts` — dashboard notification workflow
- `/api/v1/zones` and `/api/v1/settings` — safety rules and tuning
- `/api/v1/models/active` — deployed model and temporal configuration
- `/api/v1/ws/events` — authenticated camera and alert updates

## Current boundary

This is a pilot-ready academic system, not a certified safety control. It does not perform face recognition, identify employees, trigger disciplinary action, guarantee that every violation is detected, or replace human safety supervision. Real RTSP validation, SSO, external security testing, multi-site isolation, high availability, formal PDPA review, and customer SLA are commercialization-phase requirements.
