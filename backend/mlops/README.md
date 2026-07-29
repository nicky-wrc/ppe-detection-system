# PPE model evaluation protocol

No factory image may enter this repository. Begin collection only after written approval, privacy notice, access list, retention period, and permitted research use are documented.

## Dataset contract

- Annotate only `person`, `helmet`, and `safety-vest` for this pilot.
- Include compliant and non-compliant people, occlusion, low light, motion blur, multiple people, ordinary caps, and similarly colored clothing.
- Split 70/15/15 by camera and recording day. Adjacent frames from one clip must stay in one split.
- Have a second reviewer inspect at least 10% of annotations and resolve disagreements before training.
- Keep the locked test split unchanged after the first reported experiment.

## Reproducible runs

```powershell
python -m app.ml.train_ppe --data mlops/ppe_factory.yaml --model yolo8s.pt --name factory-yolo8s-v1
python -m app.ml.evaluate_ppe --data mlops/ppe_factory.yaml --model experiments/factory-yolo8s-v1/weights/best.pt --split test --output experiments/factory-yolo8s-v1/test_metrics.json
```

Compare the unchanged SH17 baseline, fine-tuned frame model, fine-tuned model with temporal confirmation, and the final TensorRT FP16 engine. Report per-class precision, recall, F1, mAP50, mAP50-95, event-level false alerts per camera-hour, missed-event rate, latency, and analyzed FPS.

The frame evaluator writes the model and dataset-manifest SHA-256 values, aggregate metrics, per-class metrics, and Ultralytics timing into the JSON report. A class with no target labels is emitted with `null` metrics so that an incomplete locked split cannot look like a valid zero score.

## Event-level acceptance report

Create two UTF-8 CSV files outside Git. The locked ground-truth sheet contains only expected violation episodes:

```csv
event_id,camera_id,zone_id,violation_type,start_time,end_time
gt-001,camera-1,zone-a,no_helmet,2026-07-29T12:00:00+07:00,2026-07-29T12:00:08+07:00
```

Export or review the system events into this prediction shape:

```csv
event_id,camera_id,zone_id,violation_type,alert_time
event-123,camera-1,zone-a,no_helmet,2026-07-29T12:00:01.2+07:00
```

All timestamps must include a timezone. `camera-hours` is the sum of monitored hours across cameras; for example, four cameras observed for eight hours equals `32`. Run:

```powershell
python -m app.ml.evaluate_events `
  --ground-truth D:\approved-pilot\locked-events.csv `
  --predictions D:\approved-pilot\system-events.csv `
  --camera-hours 32 `
  --output experiments\factory-yolo8s-v1\event_metrics.json `
  --require-pass
```

Matching uses deterministic maximum one-to-one assignment and requires the same camera and violation type. If the ground-truth row has a `zone_id`, the zone must also match. An alert must occur between the episode start and its end plus `--grace-seconds` (default three seconds). Duplicate alerts become false positives. The report records TP/FP/FN IDs, precision, recall, F1, false alerts and missed violations per camera-hour, latency p50/p95, input SHA-256 values, and each locked acceptance decision.

Do not tune thresholds against this report and rerun the same locked split as if it were new evidence. Record failed gates and evaluate remediation on a new, predeclared experiment while preserving the original report.
