"""Offline two-model trial; isolated process, fixed samples, no DB/camera/media writes."""
import argparse
import json
import os
from pathlib import Path
import sys
import threading
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--backend", choices=["onnx", "pytorch"], required=True)
    parser.add_argument("--tools", type=Path, required=True)
    parser.add_argument("--artifacts", type=Path, required=True)
    parser.add_argument("--images", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--count", type=int, default=20)
    parser.add_argument("--api-imports", action="store_true")
    parser.add_argument("--hybrid", action="store_true")
    args = parser.parse_args()
    if args.hybrid and not args.api_imports:
        raise ValueError('Hybrid measurement requires --api-imports')
    if args.report.exists():
        raise ValueError("Report exists; never overwrite an earlier result")
    sys.path.insert(0, str(args.tools.resolve()))
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    os.environ["YOLO_AUTOINSTALL"] = "false"
    if args.api_imports:
        if args.backend != 'onnx':
            raise ValueError('API import measurement is for the ONNX trial')
        os.environ.update(ENVIRONMENT='test', DATABASE_URL='sqlite:///:memory:',
            DATABASE_SCHEMA='', DATABASE_ROLE='', AUTO_CREATE_TABLES='false',
            BOOTSTRAP_ADMIN_EMAIL='', BOOTSTRAP_ADMIN_PASSWORD='',
            CLOUD_BROWSER_RECORDING='false', EVIDENCE_RETENTION_ENABLED='false',
            INFERENCE_BACKEND='onnx', INFERENCE_DEVICE='cpu', INFERENCE_IMAGE_SIZE='320',
            PPE_CROP_REFINEMENT='false',
            MODEL_PATH=str(args.artifacts.resolve()/'ppe.onnx'),
            PERSON_MODEL_PATH=str(args.artifacts.resolve()/'person.onnx'))
    import psutil
    process = psutil.Process()
    peak = [process.memory_info().rss]
    finished = threading.Event()

    def sample_memory():
        while not finished.wait(0.01):
            peak[0] = max(peak[0], process.memory_info().rss)

    sampler = threading.Thread(target=sample_memory, daemon=True)
    sampler.start()
    import cv2
    import numpy as np
    from app.ml.onnx_runtime import OnnxModel, letterbox, decode_predictions
    if args.api_imports:
        # Import routes/services without starting lifespan, opening DB or cameras.
        from app.main import app
        from app.ml.detector import get_detector
        detector = get_detector()
    if args.backend == "onnx":
        models = ({'ppe':detector.ppe_model, 'person':detector.person_model} if args.api_imports
                  else {key: OnnxModel(args.artifacts / (key + ".onnx")) for key in ("ppe", "person")})
    else:
        import torch
        from ultralytics import YOLO
        torch.set_num_threads(1)
        models = {key: YOLO(str(args.artifacts / (key + ".pt"))) for key in ("ppe", "person")}
        for model in models.values():
            model.model.float().eval().fuse(verbose=False)
    records = []
    files = sorted(args.images.glob("*.jpg"))[:max(1, min(args.count, 100))]
    if not files:
        raise ValueError("No approved test JPEGs found")
    for path in files:
        frame = cv2.imread(str(path))
        if frame is None:
            raise ValueError("Invalid test image")
        record = {"image": path.name, "models": {}}
        for key, model in models.items():
            started = time.perf_counter()
            classes = [0] if key == "person" else None
            if args.backend == "onnx":
                boxes = model.predict(frame, conf=0.20, iou=0.45, imgsz=320,
                                      device="cpu", classes=classes)[0].boxes
            else:
                tensor, ratio, padding = letterbox(frame, 320)
                with torch.inference_mode():
                    raw = model.model(torch.from_numpy(tensor))[0].numpy()
                boxes = decode_predictions(raw, len(model.names), 0.20, 0.45,
                                           classes, ratio, padding, frame.shape[:2])
            record["models"][key] = {"ms": (time.perf_counter() - started) * 1000,
                "boxes": [{"class": int(b.cls[0]), "score": float(b.conf[0]),
                           "xyxy": b.xyxy[0].tolist()} for b in boxes]}
        records.append(record)
        if args.hybrid:
            started = time.perf_counter()
            result = detector.detect(frame)
            record['hybrid_ms'] = (time.perf_counter() - started) * 1000
            record['hybrid_person_count'] = result['person_count']
            del result
    peak[0] = max(peak[0], process.memory_info().rss)
    finished.set()
    sampler.join()
    report = {"backend": args.backend, "platform": sys.platform,
              "api_imports": args.api_imports,
              "hybrid": args.hybrid,
              "input": 320, "precision": "FP32", "samples": len(records),
              "peak_rss_mib": peak[0] / 1024 ** 2,
              "final_rss_mib": process.memory_info().rss / 1024 ** 2,
              "torch_imported": "torch" in sys.modules,
              "mean_pair_ms": float(np.mean([sum(m["ms"] for m in r["models"].values()) for r in records])),
              "records": records}
    args.report.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "records"}, indent=2))


if __name__ == "__main__":
    main()
