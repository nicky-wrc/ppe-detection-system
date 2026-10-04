# Deployment preparation — PPE Detection System

This is a preparation checklist, not a deployment or production approval.
No hosting provider, domain, public endpoint or remote runtime has been selected.
The existing local services and private Supabase connection remain unchanged.

## Model audit (2026-10-04)

- Running authenticated `/api/v1/models/active` reports version
  `orange-ppe-yolov8m-yolo11n-hybrid-20260917-v4` and both artifacts available.
- PPE: `backend/experiments/orange-ppe-yolo8m-20260917-v4/weights/best.pt`,
  52,044,626 bytes, SHA-256
  `833fa3362afad19f27ff68ac44a52e598d26bd96f7f9f750b5469bd2382e0b9c`.
- Person assist: `backend/yolo11n.pt`, 5,613,764 bytes, SHA-256
  `0ebbc80d4a7680d14987a577cd21342b65ecfd94632bd9a8da63ae6417644ee1`.
- Running backend process uses `run_local.py --disable-wmi`, which refuses model
  fallback. Separate `--check` loads the configured pair on `cuda:0` with crop
  refinement and low-light enhancement enabled. The check is not an inference
  accuracy test or direct inspection of the running process's model memory.
- YOLOv8m v4 is the latest successful local PPE fine-tune. YOLO11n is the existing
  pretrained person detector; no new YOLO11 training run is recorded.
- Latest is not best on every metric. See `backend/mlops/ORANGE_PPE_RESULTS_20260917.md`:
  orange-like vest F1 75.17→76.06%, helmet F1 84.76→84.79%; full-test helmet F1
  85.67→85.10%. These are raw predictions on public data, not camera/event accuracy.

## Prepared build changes

- Backend/frontend contexts use allowlists: secrets, virtual environments,
  datasets, checkpoints, evidence and generated builds are not copied.
- A root `.dockerignore` also protects accidental repository-root contexts.
- Frontend Docker build uses `npm ci` and accepts PUBLIC `VITE_API_URL` at build
  time. Never pass DB credentials, JWT signing keys or bootstrap secrets here.
- Models/evidence must be supplied separately at runtime. This deliberately means
  a backend image alone cannot perform detection; do not ship it without weights.
- Standard Docker CPU image does not become a CUDA image merely by attaching a
  GPU. The target CUDA runtime/PyTorch install must be chosen and tested separately.
- Existing `docker-compose.yml` is for local PostgreSQL: it overrides DATABASE_URL
  to service `db`. Do NOT use it unchanged for the Supabase deployment.

## Blocking decisions before publishing

1. Choose architecture and hosting: keep GPU/USB/evidence on the current Windows
   backend behind controlled HTTPS access, or migrate to a separate server with
   adequate inference resources. No cloud server can directly access a USB camera
   plugged into the Windows PC. Browser-camera capture requires HTTPS/permissions.
2. Choose one native-camera runtime owner. Shared Supabase does not share runtime
   locks, active flags, rate limiters or WebSocket broadcast state across servers.
3. Approve the model/license/privacy scope. `MODEL_LICENSE_APPROVED=false` remains
   intentional; production mode refuses to start. Do not bypass the gate by
   relabelling public deployment as development. Research demo approval and a
   commercial release are different; follow `docs/pilot/COMMERCIALIZATION_GATE.md`.
4. Choose domain and HTTPS ingress. Set exact allowed origins only after choosing
   the frontend URL. Preserve WebSocket upgrades and long-lived preview streams.
   Restrict unauthenticated `/metrics` and development API docs at ingress.
5. Set runtime secrets privately; rotate development/shared credentials as a
   separately approved operation. No credentials belong in image layers or Vite.
6. Arrange persistent storage and a reviewed migration for existing Windows media
   paths if moving hosts. Shared DB does not upload/share local image/video files.
   Do not expose uploads as an unauthenticated static directory.
7. Preserve all existing data and `EVIDENCE_RETENTION_ENABLED=false` during this
   transition. Back up before cutover; enable no cleanup without explicit approval.
8. Resolve timezone support before release: full backend tests currently fail in
   daily analytics because this Windows venv has no IANA `Asia/Bangkok` database.
   A `tzdata` dependency is a proposed fix, not an installed/approved change.
   Check timezone support in the eventual image too, rather than assuming it.

## Build commands after target selection

Public API URL must include `/api/v1`. The examples use placeholders, not live hosts:

```powershell
docker build --build-arg VITE_API_URL=https://api.example.com/api/v1 -t ppe-frontend ./frontend
docker build -t ppe-backend ./backend
```

Configure frontend/API routing together. `/api/v1` works only if the chosen
frontend origin reverse-proxies that path to the backend. Existing API URL fallback
uses the browser host on port 8000, which is not a correct default for cloud HTTPS.
Changing a container runtime env variable does not rebuild a Vite browser bundle.
Never bind-mount the whole backend directory into a published image to restore
models; supply the exact checkpoint and person model paths as read-only mounts.

## Acceptance checks before releasing a URL

- Inspect final image contents/history for secrets and private artifacts.
- Compare model SHA-256 and actual loaded device; no fallback, expected CUDA/CPU
  crop behavior, measured latency and target-camera test.
- Readiness, authentication, all three roles, Dashboard, reports/details/evidence.
- Camera permissions, preview, start/stop/reconnect, WebSocket and CORS over HTTPS.
- Backups/restore and rollback; validate media links without deleting old files.
- No duplicate native-camera process; protected media remains authenticated.
- Run backend tests, frontend lint/typecheck/build. Record pre-existing failures.
- Docker image build/run and real hosted-browser tests are still required.

## Local validation results (2026-10-04)

- `/health` healthy, `/ready` database ok on the running local backend.
- Authenticated live Stats API returns 200, but daily analytics returns 500.
  Isolated reproduction confirms the same missing Asia/Bangkok timezone error.
- Deployment asset and launcher tests: 7 passed.
- Full backend suite on isolated SQLite: 117 passed, 1 failed, 44 warnings.
  Failure: `test_role_access.py::test_viewer_reads_all_shared_data_and_evidence_but_cannot_mutate`
  reaches daily analytics and raises `ZoneInfoNotFoundError: Asia/Bangkok`.
  Backend application source/dependencies were unchanged in this preparation.
- Frontend ESLint: zero errors, two existing CameraPage hook dependency warnings.
- TypeScript application check passed; Vite production bundle built to a separate
  private directory with placeholder public API URL, without replacing local dist.
- Docker executable exists, but Docker Desktop Linux engine is not running.
  Image build/context enforcement has NOT been validated by a real Docker build.

Sources:
- https://docs.docker.com/build/concepts/context/
- https://docs.docker.com/build/building/secrets/
- https://vite.dev/guide/env-and-mode
- https://docs.python.org/3/library/zoneinfo.html
