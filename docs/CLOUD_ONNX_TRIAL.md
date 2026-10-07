# ONNX cloud trial — 2026-10-07

## Scope and status

Hosted update: user approved promotion after the offline trial. Render deploy
dep-db375c60tbcc73fshej0 (commit 4911fc6) reached Live with Dockerfile.onnx.
Health/readiness returned healthy/ready and cloud recording stayed enabled.
Real frame inference and sustained hosted memory acceptance remain pending.
Local render.yaml follow-up now matches this configuration and needs user push.
Earlier trial-only status below describes the pre-promotion experiment.

Opt-in CPU runtime using the same v4 YOLOv8m PPE weights and YOLO11n person
weights. No retraining, quantization, database migration, local `.env` change,
or hosted promotion was performed. Default remains PyTorch. `render.yaml` still
selects the existing image. This is a research demo, not a safety certification.

The Render Free process previously exceeded its memory limit. A CORS message
can be secondary to an unavailable API/proxy error; removing authorization or
opening CORS cannot fix process memory exhaustion.

## Offline measurements

Windows, Intel i5-13500, CPU, batch 1, square 320 input, FP32, one inference
thread. Memory sampled every 10 ms; short peaks may be missed. Identical sorted
existing test JPEGs were used. No camera, database writes, or evidence uploads.

| Process | Samples | Peak RSS MiB | Mean two-model ms |
| --- | --- | --- | --- |
| PyTorch baseline | 30 | 748.28 | 324.41 |
| ONNX models only | 30 | 197.34 | 289.93 |
| ONNX plus API imports | 60 | 263.10 | 278.79 |
| ONNX API imports plus hybrid association | 60 | 272.21 | 285.33 |

ONNX processes did not import torch. Baseline used the existing Windows
CUDA-enabled PyTorch installation running on CPU, not Render's Linux CPU wheel.
The API import trial does not start application lifespan or exercise HTTP,
database/storage connections, concurrent requests, or long-running camera load.
These figures are not a guarantee of Linux/Render memory usage or FPS.
The hybrid run also exercises `detector.detect` on each image (in addition to
the raw-model replay), including configured low-light processing and PPE-person
association. Its pair timing column measures the raw pair, not total request time.

Replay comparison: 253 matched boxes across 30 images, no count/class mismatch,
maximum confidence difference 0.00000218 and coordinate difference 0.000260 px.
Both backends used the same preprocessing and postprocessing in this comparison.
It demonstrates numerical export agreement at 320, not new accuracy results or
equivalence to local CUDA inference at 640 with crop refinement.

## Files preserved outside Git

`backend/experiments/onnx-v4-fp32-320-20261007/` contains source copies,
exports, manifest, and benchmark reports. Original `.pt` files are unchanged.

| Export | Bytes | SHA-256 |
| --- | --- | --- |
| ppe.onnx | 103501130 | 5c7ab0aab104a90b0531edcd4146f573f4d5cc90ea42d352da895e5f5ad65228 |
| person.onnx | 10575913 | f68462ab9ebaeb7aab8716ebab31e66269439bd9ff123f424ed3f2420ddf8faa |

Export tooling is isolated in `backend/experiments/onnx-runtime-tools`, not
installed into the normal virtual environment. Export uses opset 17, no embedded
NMS, no simplification, static input, FP32. It refuses to overwrite previous output
and verifies original checkpoint hashes before/after export.

## Reproduce from backend

Use a new report filename each time; reports are never overwritten.

```powershell
.\.venv\Scripts\python.exe scripts/benchmark_onnx_trial.py --backend onnx --api-imports --hybrid --tools experiments/onnx-runtime-tools --artifacts experiments/onnx-v4-fp32-320-20261007 --images datasets/hardhat-vest-v3-sh17/orange-focus-5000-v2/dataset/images/test --report experiments/onnx-v4-fp32-320-20261007/new-hybrid-report.json --count 60
.\.venv\Scripts\python.exe scripts/compare_onnx_trial.py experiments/onnx-v4-fp32-320-20261007/pytorch-benchmark.json experiments/onnx-v4-fp32-320-20261007/onnx-lazy-benchmark.json
```

## Hosted trial gate and rollback

1. Commit/push source after review; model artifacts must remain outside Git.
2. Upload both exports into private model Storage. Check bucket/global size
   limits first: the PPE export is 98.71 MiB and larger than the Free project's
   50 MB per-file cap, so it cannot be uploaded as a single file there. Do not
   make it public. The additive multipart implementation below now permits
   bounded download/reassembly without changing the model.
   Source: https://supabase.com/docs/guides/storage/uploads/file-limits
3. Supply new private download URLs in Render, never Git. Signed URLs expire and
   must remain valid on every rebuild/restart requiring download.
4. Only after explicit promotion, select `./backend/Dockerfile.onnx` and set:

   ```dotenv
   INFERENCE_BACKEND=onnx
   INFERENCE_DEVICE=cpu
   INFERENCE_IMAGE_SIZE=320
   PPE_CROP_REFINEMENT=false
   MODEL_PATH=./runtime_models/ppe.onnx
   PERSON_MODEL_PATH=./runtime_models/person.onnx
   MODEL_VERSION=orange-ppe-yolov8m-yolo11n-hybrid-20260917-v4-onnx-fp32-320
   ```

   Keep demo schema/role, private Storage, recording consent, license=false,
   origins and all existing secret values. Download variables are
   `PPE_MODEL_DOWNLOAD_URL` and `PERSON_MODEL_DOWNLOAD_URL`. Startup verifies
   exact export hashes and refuses incompatible shapes/classes or fallback.
5. Validate Linux image dependency installation, readiness, authorized login,
   frame inference, consented persistence/evidence retrieval, repeated frames,
   and concurrency while observing Render memory and events. Docker Desktop's
   Linux engine was unavailable locally; Linux image validation remains pending.
6. If it fails, restore Dockerfile.render, INFERENCE_BACKEND=pytorch, original
   .pt paths, URLs and model version together. Keep ONNX exports for diagnosis.
   Restoring the old image does not resolve its documented 512 MB OOM limit.

Do not claim all localhost functions are enabled: remote RTSP/private-network
camera access still requires a separately scoped on-site connector. No cloud
or original data is deleted by this trial.

## Multipart preparation completed

`backend/scripts/split_model_artifact.py` created three ordered parts in
`backend/experiments/onnx-v4-fp32-320-20261007/upload-parts/`:

| File | Bytes |
| --- | --- |
| ppe.onnx.part001 | 41943040 |
| ppe.onnx.part002 | 41943040 |
| ppe.onnx.part003 | 19615050 |

The local `parts-manifest.json` includes each part's SHA-256 and the verified
reassembled SHA-256, equal to the original export. No compression/precision
change occurred. This folder and model exports remain ignored by Git.

Next upload these three files plus the existing `person.onnx` to the **private**
`ppe-demo-models` bucket. Do not upload `.pt` copies or benchmark images. Obtain
private signed URLs (valid for all future downloads until expiry).

In Render secrets, enter `PPE_MODEL_PART_URLS` as an ordered JSON array:

```json
["SIGNED_URL_FOR_PART001","SIGNED_URL_FOR_PART002","SIGNED_URL_FOR_PART003"]
```

Set `PERSON_MODEL_DOWNLOAD_URL` to the signed URL of `person.onnx` and leave
`PERSON_MODEL_PART_URLS` unset. `PPE_MODEL_PART_URLS`, when nonempty, takes
precedence over the old `PPE_MODEL_DOWNLOAD_URL`; clear it when rolling back to
PyTorch. Never store signed URLs in Git, frontend environment variables or docs.
Malformed part configuration fails instead of falling back to an old model.

Startup streams parts in order with 64 KiB chunks directly into a temporary file,
at most 40 MiB per part / 100 MiB total / eight parts. It rejects redirects, empty
parts and non-200 responses; the compiled trusted whole-model hash detects missing,
reordered or damaged bytes before publishing the checkpoint. Failure removes only
its own temporary download. Existing mismatched models and preexisting temporary
files are preserved and startup stops. Single-file `.pt` downloads still work.

Upload and hosted promotion were subsequently completed with user approval.
No `.env` or storage policy was changed; original model artifacts remain.
