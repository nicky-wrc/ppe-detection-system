# Deploy the controlled research demo on Render Free

Prepared 2026-10-06. This guide does not mean a deployment is live or that a free
instance can run the model within its memory/latency limits. Do not send a URL to
testers until the acceptance checks below pass. No paid resources are configured.

2026-10-07 hosted incident: Render reported memory above its 512 MiB limit during
the browser-camera trial. The free Blueprint now starts at `INFERENCE_IMAGE_SIZE=320`
with both `PPE_CROP_REFINEMENT` and `PPE_CROP_REFINEMENT_ON_CPU` disabled. This keeps
the exact v4/YOLO11n weights, but can reduce small/distant PPE recall. These settings
are a memory-reduction trial, NOT proof that 512 MiB is sufficient. Keep local `.env`
unchanged. Require an actual inference/memory test after deployment; if it still
fails, stop retrying and choose separate inference hosting or a measured optimized
runtime rather than silently changing the model or purchasing compute.

Current setup (2026-10-06): approved `ppe_demo` / `ppe_demo_app` provisioning and
online migrations have been applied to the existing project. Twelve demo tables
(including `alembic_version`) exist at revision `20260929_01`, with zero demo users.
Original public schema/ACL/row-count/version snapshots matched before and after.
Local backend `.env` was NOT changed. Credentials are in the ACL-restricted file
`D:\ppe-detection-system\private-backups\render-demo-schema-20261006\render-demo.env`.
Do NOT rerun setup against existing objects; use that private connection in Render
after reviewing/pushing the updated schema-aware deployment files.

## Scope of the first URL

- Invitation-only academic demonstration, not public registration or safety use.
- Only staged/authorized test images; no real factory collection without site and
  data-controller approval. A checkbox is NOT a substitute for that approval.
- Browser USB/Webcam capture via HTTPS, one in-flight inference globally and one
  request at a time per browser. Delay between results is at least two seconds.
- Frames are processed in memory, not stored as evidence or detection history.
- Server USB/RTSP discovery/start and persistent image/video uploads are disabled.
- Invited demo users share demo data; this is NOT per-factory tenant isolation.
  The existing Supabase project can be reused ONLY with the dedicated `ppe_demo`
  schema and `ppe_demo_app` database login. Existing `public` data is not copied.
- Local development, existing database/media/model files and production license
  gate remain unchanged. `research_demo` requires explicit acknowledgements;
  it does not establish license/privacy approval or production readiness.

## 1. Prepare the isolated schema in the existing Supabase project

1. Sign in to Render using GitHub, authorize ONLY the required repository.
2. Keep the old database tables, accounts and local `backend/.env` unchanged.
   The user approved schema reuse because the account has no free project quota.
3. From `backend`, run the additive preparation script first in read-only mode:

   ```powershell
   .\.venv\Scripts\python.exe scripts/prepare_demo_schema.py --project-ref wjnlwekpfiveihrzchlh
   ```

   It reads the existing private `.env` operator connection without logging it.
   Applying requires `--apply --secret-dir <existing-private-absolute-directory>`.
   Protect that directory with ACLs for the owner and SYSTEM only before applying.
   Script generates a separate password, exclusively saves `render-demo.env` outside
   Git, creates only `ppe_demo_app` and `ppe_demo` transactionally, and refuses
   collisions/unsafe inherited grants. It NEVER changes or migrates public tables.
   If preparation fails, stop and review; do not revoke broad old-project grants
   or delete/reuse existing objects just to make setup succeed.
   PostgreSQL 16+ managed-role setup temporarily grants the operator SET on the
   newly created demo role for ownership/default ACL setup, then revokes SET and
   leaves INHERIT disabled. It never grants operator privileges to the demo role.
4. Use the GENERATED role connection in Render, not the old postgres URL:
   `postgresql://ppe_demo_app.<project-ref>:<new-role-password>@<session-pooler-host>:5432/postgres?sslmode=require`.
   Password is URL-encoded by the script. Keep the file private; do not paste it
   into chat or upload it to Git. The old `.env` continues to use public tables.
5. Blueprint sets `DATABASE_SCHEMA=ppe_demo` and `DATABASE_ROLE=ppe_demo_app`.
   Every connection checkout restores search_path without public fallback and
   checks actual login, ownership, role flags/membership, outside table/sequence
   privileges, schema/database CREATE rights and demo schema Data API access.
   Alembic has its own `ppe_demo.alembic_version`; existing revisions run online
   against the demo only. Offline schema SQL is rejected because it cannot audit
   permissions. Schema setup is additive, not a new revision of public tables.
   Standard system catalogs and the genuine pg_stat_statements extension's two
   built-in metadata views are permitted; other roles' SQL text remains protected
   by PostgreSQL, and the demo login is denied elevated/membership roles. An
   unrelated view with the same name is NOT exempted from the grant check.
6. Do not expose `ppe_demo` through Supabase Data API or grant anon/authenticated
   schema access. Keep demo tables/sequences private and recheck after deployment.
   Do not disable/change the existing project's APIs blindly if another app uses
   them. Schema separation shares storage/compute/quota with the original project;
   it does not provide separate-project availability or disaster isolation.

## 2. Supply model artifacts privately

The trained PPE file is not in Git and intentionally excluded from Docker contexts.
Upload just these two artifacts to a PRIVATE storage bucket you control:

| File | SHA-256 |
| --- | --- |
| `backend/experiments/orange-ppe-yolo8m-20260917-v4/weights/best.pt` | `833fa3362afad19f27ff68ac44a52e598d26bd96f7f9f750b5469bd2382e0b9c` |
| `backend/yolo11n.pt` | `0ebbc80d4a7680d14987a577cd21342b65ecfd94632bd9a8da63ae6417644ee1` |

Provide authenticated HTTPS download URLs in PPE_MODEL_DOWNLOAD_URL and
PERSON_MODEL_DOWNLOAD_URL. MODEL_DOWNLOAD_TOKEN is a server-only bearer token
(also sent as apikey for private Supabase Storage downloads). Use operator-approved
URLs without embedded username/password. Redirects are intentionally rejected.
Do not include datasets, .env, uploads, private backups or other weights.
Avoid expiring signed URLs unless you can renew them before cold starts/restarts;
artifacts must be downloadable every time an ephemeral Render instance starts.
Never publish weights whose redistribution rights have not been approved.
On a reused project, do NOT give Render the existing broad service-role/admin API
key solely to download weights. Prefer a storage identity limited to the model
bucket, or private signed artifact URLs with an explicit renewal plan (leave
MODEL_DOWNLOAD_TOKEN empty for signed URLs). Database role isolation does not
limit a separately supplied broad Storage/Data API token.

## 3. Commit/push reviewed changes yourself, then create a Blueprint

1. Review `git diff`; no secrets or checkpoints should be staged.
2. Commit/push to the GitHub branch chosen for deployment. The agent has NOT done
   this automatically. Ensure Render is reading that branch.
3. Render Dashboard → New → Blueprint → choose repository and `render.yaml`.
4. The Blueprint configures one FREE Docker Backend and one FREE Static Site.
   No Render database or paid disk is created. Keep workspace billing limits set
   to avoid bandwidth/build overages; free compute does not guarantee a zero bill
   if the account permits paid usage.
5. Fill secret/manual environment entries:

| Variable | Value |
| --- | --- |
| DATABASE_URL | Generated `ppe_demo_app.<project-ref>` session-pooler URI with TLS |
| DATABASE_SCHEMA / DATABASE_ROLE | `ppe_demo` / `ppe_demo_app` (provided by Blueprint) |
| RESEARCH_DEMO_ACKNOWLEDGED | `true` only after reviewing scope/license/privacy |
| RESEARCH_DEMO_DATABASE_CONFIRMED | `true` only after verifying dedicated role/schema isolation |
| ALLOWED_ORIGINS | Exact HTTPS frontend URL, comma separated if needed |
| BOOTSTRAP_ADMIN_EMAIL | New demo administrator email |
| BOOTSTRAP_ADMIN_PASSWORD | New strong demo password, not the local password |
| PPE_MODEL_DOWNLOAD_URL / PERSON_MODEL_DOWNLOAD_URL | Private model HTTPS URLs |
| MODEL_DOWNLOAD_TOKEN | Private bucket download authorization |
| VITE_API_URL (frontend only) | Actual public backend URL plus `/api/v1` |

SECRET_KEY is generated by Render; never replace it with the existing local key.
Do not guess URLs from service names: Render may add suffixes. If deploying the
Blueprint requires URL values before allocation, set HTTPS placeholder values,
then update to the REAL allocated URLs and rebuild frontend before any testing.
The placeholder origin will not allow a browser to access the API.

Backend starts `render_start.py`, downloads/hash-verifies the exact checkpoints,
migrates only the verified demo schema and rejects model fallback. It uses CPU-only
PyTorch, one Uvicorn worker, full-frame inference size 640 and one crop person.
The bootstrap administrator can create invited `safety_officer` accounts in Users;
Viewer cannot detect. Each tester should have their own account, not shared admin.

## 4. Test the actual hosted URL before sharing

1. Backend `/ready` returns 200. Check no OOM/restart loop or checkpoint failures.
2. Frontend `/login` and `/detect` direct navigation work (SPA rewrite provided).
3. Log in as a demo safety officer, consent to the test, allow browser camera.
   Open Webcam/USB; stop it and confirm camera indicator goes off.
4. Inspect the browser request to `/api/v1/detection/frame`: response contains actual
   persons/PPE, not a fallback/mocked result. Measure end-to-end latency and RAM.
5. Native-camera API, persistent image/video/report endpoints and `/metrics` return
   403. Anonymous frame requests require authentication. No history/evidence grows.
6. Test two browsers: only one backend frame at a time; busy requests return 429,
   UI retries serially. Restrict initial tests to one camera at a time.
7. Verify HTTPS, exact CORS origins, model/version and clear experimental notices.
8. After an idle cold start, confirm artifacts download and login/detection recover.
9. Confirm the demo has its own users and Alembic version; original local accounts
   cannot sign in unless separately created for the demo. Verify old public rows
   and schema/version are unchanged. A schema is NOT a filter based on app Roles.
10. On failure stop the Render backend and inspect the cause; leave old `.env`,
    public data and the demo schema in place. No DROP/CASCADE cleanup is needed.

Free Web Services currently have 512 MB RAM/limited CPU and sleep after 15 minutes
idle. The two-model PyTorch runtime may exceed the free memory limit: successful
local tests or a static frontend do not establish success on Render. If it OOMs,
pause the service; do NOT silently switch weights or claim that the model works.
Choose a measured optimization/alternative or ask before upgrading a paid plan.
No persistent media on Free is intentional; its filesystem disappears on restart.

## 5. Attach dtech.life AFTER acceptance

Frontend Settings → Custom Domains → add `dtech.life`. Follow the exact DNS records
Render supplies at the domain registrar. Do not change mail records or unrelated
DNS. Once TLS is active, add `https://dtech.life` to backend ALLOWED_ORIGINS and
verify login/camera again. Keep onrender.com origin only if it is still needed.
An API custom domain is optional; VITE_API_URL can use Render's backend HTTPS URL.

Remaining human/external steps: schema/role provisioning if not yet applied, private
model upload/access, reviewed push, actual deployment, DNS and
hosted camera tests. No real URL is ready until those steps are completed.

References:
- https://render.com/docs/free
- https://render.com/docs/blueprint-spec
- https://render.com/docs/custom-domains
- https://supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI
- https://alembic.sqlalchemy.org/en/latest/cookbook.html#rudimental-schema-level-multi-tenancy-for-postgresql-mysql-other-databases
- https://www.postgresql.org/docs/17/pgstatstatements.html
