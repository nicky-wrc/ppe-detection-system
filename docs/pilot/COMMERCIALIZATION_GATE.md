# Commercialization gate

This checklist prevents a research result from being represented or shipped as a production safety product before its evidence, licenses, and operating controls are ready. Record the reviewer, date, document link, and decision for every item. `MODEL_LICENSE_APPROVED=true` is only an assertion that this review was completed; the application cannot verify legal rights itself.

## Blocking license decisions

- [ ] Choose and document one Ultralytics route: release the complete applicable work under AGPL-3.0, or obtain written commercial/Enterprise rights for the exact product and deployment scope. Ultralytics currently identifies proprietary applications, internal business tools, edge deployments, and custom-trained models as commercial-license cases: https://www.ultralytics.com/license
- [ ] Do not sell, license, or deploy the bundled SH17-derived checkpoints as the commercial model. The dataset publisher states that SH17 is CC BY-NC-SA 4.0 and intended for educational, research, and analysis use: https://github.com/ahmadmughees/SH17dataset#license
- [ ] Train the release model only from customer-owned, commissioned, or explicitly commercially licensed images. Preserve releases, source URLs/contracts, allowed uses, attribution, retention, and deletion terms in a dataset registry outside Git.
- [ ] Have qualified counsel review the final combination of runtime, model weights, datasets, source code, fonts/assets, and third-party packages. Generate an SBOM and notices for every release.

## Data protection and worker governance

- [ ] Obtain written site/data approval before collecting target-factory media; complete `DATA_APPROVAL_CHECKLIST.md` first.
- [ ] Complete the applicable privacy assessment (including Thailand PDPA where relevant), lawful-basis analysis, worker notice/consultation, processor agreements, access procedure, incident response, and deletion verification.
- [ ] Prohibit face recognition, worker identity inference, automated disciplinary decisions, covert monitoring, and reuse of footage for unrelated purposes.
- [ ] Verify face blurring and the 30-day evidence deletion job on real pilot output. Restrict raw footage and encryption keys separately from application operators.

## Model evidence

- [ ] Freeze a camera/day/site-separated test set before tuning. Keep adjacent frames and the same worker/scene out of different splits.
- [ ] Double-review at least 10% of labels and all ambiguous hard cases; report inter-annotator agreement and adjudication rules.
- [ ] Report per-class precision, recall, F1, AP50, AP50-95, false alarms per camera-hour, missed violations per camera-hour, time-to-alert, FPS, and confidence intervals.
- [ ] Compare the baseline, factory fine-tune, temporal filter, and optimized edge model on the same locked set. Publish failure slices for distance, occlusion, lighting, PPE color/style, crowding, and camera angle.
- [ ] Pass the predefined criteria in `ACCEPTANCE_TEST_PROTOCOL.md`; record negative results and limitations rather than selecting only favorable runs.

## Production engineering

- [ ] Replace the in-process camera runtime and in-memory rate limiter before multi-instance deployment with supervised workers plus a shared queue/state store.
- [ ] Validate every target USB/RTSP camera and the NVIDIA 8 GB edge device for an 8-hour soak, restart recovery, disconnect/reconnect, clock drift, disk pressure, and offline alerting.
- [ ] Complete external penetration testing, dependency/container scanning, secret rotation, encrypted backup/restore drills, signed artifacts, and rollback rehearsal.
- [ ] Implement organization/site isolation before serving multiple customers. Add SSO/OIDC, audit-log export, least-privilege roles, and customer-specific retention policies where required.
- [ ] Define support ownership, severity levels, SLA/SLO, remote update strategy, observability retention, hardware bill of materials, and end-of-life policy.

## Release record

- [ ] Release model name/version and SHA-256:
- [ ] Training dataset registry/version and approval:
- [ ] Ultralytics/commercial license evidence:
- [ ] Test report and acceptance result:
- [ ] Privacy/security approvals:
- [ ] Approving names, dates, and scope:
