# Browser-camera recording on the research demo

Status: code implemented locally; not enabled or verified on the hosted service.
This is not full localhost parity and is not a safety-certified factory deployment.

## What the optional mode does

- Explicit browser consent is required before recording.
- Existing detection tables in the isolated demo schema store results. No database
  migration, original-data deletion, original upload, or local `.env` change is needed.
- Personal recording mode and cooldown apply. Empty frames are not recorded.
- If `save_evidence` is enabled, the existing best-effort head-region blur is
  applied before JPEG upload. Blur does not guarantee anonymity. No continuous
  video or raw original frame is persisted by this mode.
- A private Supabase bucket stores evidence across Render restarts. Protected
  backend media endpoints proxy evidence after application authentication.
- Metadata with alerts becomes available to existing shared reports/dashboard
  queries; viewer accounts remain read-only.

## Provisioning gate (not performed automatically)

1. Confirm permission to store the test images and agree the research-demo scope.
   Do not collect real factory/customer data before the pilot privacy checklist.
2. Create a new **private** bucket `ppe-demo-evidence`, JPEG-only, 5 MiB maximum.
   Leave the model bucket and original data untouched. Never make evidence public.
3. Create a dedicated Supabase Auth identity for backend Storage access. Its
   password must not be an application administrator password. Confirm that
   project signup triggers do not grant this identity access to existing data.
4. Audit existing Storage policies and exposed database schemas. Permissive RLS
   policies are combined with OR, so adding a narrow policy alone cannot negate
   an existing broad grant. Verify the identity cannot read/write other buckets
   or existing application tables through the Data API before enabling it.
5. Add policies scoped to that exact Auth UUID, `bucket_id = 'ppe-demo-evidence'`,
   matching `owner_id`, and UUID-hex `.jpg` object names. Permit INSERT and SELECT
   only; no overwrite/delete grant is needed. Verify uploads and private reads
   succeed for this identity and fail for anonymous/other authenticated users.
   Prepare the exact policies only after the UUID and existing policy audit.
6. Enter secrets directly in Render backend environment (never Git/frontend/chat):

   ```dotenv
   CLOUD_BROWSER_RECORDING=true
   CLOUD_STORAGE_URL=https://YOUR_PROJECT_REF.supabase.co
   CLOUD_STORAGE_BUCKET=ppe-demo-evidence
   CLOUD_STORAGE_PUBLIC_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
   CLOUD_STORAGE_EMAIL=YOUR_DEDICATED_STORAGE_ACCOUNT_EMAIL
   CLOUD_STORAGE_PASSWORD=YOUR_DEDICATED_STORAGE_ACCOUNT_PASSWORD
   ```

   Do not use `service_role` or secret keys. Defaults remain disabled until setup.
7. Push reviewed code, deploy both services manually, then test real browser
   consent, Settings recording modes/cooldown, Reports details/protected images,
   viewer access, restart durability and unauthorized evidence rejection.

Reference: [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
and [ownership](https://supabase.com/docs/guides/storage/security/ownership).

## Remaining gaps

Native RTSP/private factory cameras need an on-site connector/VPN architecture;
Render cannot access a tester's local USB device through OpenCV. Image/video
uploads, continuous event clips, password reset without SMTP, CPU/GPU throughput
parity, factory tenant isolation and domain setup are not delivered by this mode.
Do not remove research-demo restrictions or assert model-license approval to
work around them. Full parity requires separate infrastructure and privacy design.

An upload followed by database failure can leave an unreferenced private object.
Automatic deletion remains disabled to preserve evidence; any cleanup must first
reconcile database references and receive explicit authorization.
