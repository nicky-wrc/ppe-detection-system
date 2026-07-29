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
