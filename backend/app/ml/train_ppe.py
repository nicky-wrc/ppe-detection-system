"""Reproducible fine-tuning entry point for the approved factory dataset."""

import argparse
import json
import platform
from datetime import datetime, timezone
from pathlib import Path

import ultralytics
from ultralytics import YOLO


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, help="Dataset YAML with person, helmet and safety-vest classes")
    parser.add_argument("--model", default="yolo8s.pt")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--device", default="0")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--project", default="experiments")
    parser.add_argument("--name", required=True)
    return parser.parse_args()


def main():
    args = parse_args()
    run_dir = Path(args.project) / args.name
    run_dir.mkdir(parents=True, exist_ok=True)
    manifest = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "data": str(Path(args.data).resolve()),
        "base_model": args.model,
        "epochs": args.epochs,
        "imgsz": args.imgsz,
        "batch": args.batch,
        "device": args.device,
        "seed": args.seed,
        "python": platform.python_version(),
        "ultralytics": ultralytics.__version__,
    }
    (run_dir / "run_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    model = YOLO(args.model)
    model.train(
        data=args.data,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        seed=args.seed,
        deterministic=True,
        project=args.project,
        name=args.name,
        exist_ok=True,
        patience=20,
        plots=True,
    )


if __name__ == "__main__":
    main()
