# Pilot acceptance test protocol

## Locked targets

- Event recall at least 90% and precision at least 85%
- No more than one false alert per camera-hour
- Four cameras at five analyzed FPS per camera on the target NVIDIA GPU
- Alert latency p95 no more than three seconds
- Camera reconnection within 30 seconds
- Eight-hour four-camera run without an unhandled worker failure
- At least eight target users, 90% task completion, and SUS at least 75

## Controlled scenarios

Run every scenario with at least three repetitions per camera and keep the scenario sheet with timestamps:

1. One compliant person enters and leaves the zone.
2. Missing helmet, missing vest, and missing both.
3. Two to five people with mixed compliance.
4. Partial body occlusion and PPE temporarily hidden.
5. Ordinary cap and similarly colored non-PPE clothing.
6. Low light, backlight, motion blur, and different distances.
7. Person crosses the zone boundary.
8. Camera disconnect/reconnect, API restart, database interruption, and unavailable SMTP.

## Measurement rules

- A ground-truth event is one tracked person/violation episode, not one frame.
- Record the start and end time, camera, zone, violation type, expected result, event ID, first-alert time, and reviewer decision.
- Report event-level TP/FP/FN, precision, recall, F1, false alerts per camera-hour, p50/p95 latency, FPS, GPU memory/utilization, and reconnect time.
- Keep adjacent frames from one clip in a single dataset split.
- Compare unchanged SH17, fine-tuned frame inference, fine-tuned temporal inference, and TensorRT FP16.
- Do not lower acceptance thresholds after viewing the locked test results. Record a failed gate and remediation instead.

## Automated event scoring

Prepare the locked ground-truth and reviewed system-event CSV files using the schema in `backend/mlops/README.md`. Then run from `backend/`:

```powershell
python -m app.ml.evaluate_events `
  --ground-truth D:\approved-pilot\locked-events.csv `
  --predictions D:\approved-pilot\system-events.csv `
  --camera-hours 32 `
  --output experiments\factory-yolo8s-v1\event_metrics.json `
  --require-pass
```

The command always writes the report. With `--require-pass`, it exits with code `2` when at least one locked event target fails. This report covers event precision/recall, false alerts per camera-hour, and alert latency only. FPS, reconnect time, eight-hour stability, GPU resource use, and usability still require the controlled pilot records described above.
