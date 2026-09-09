"""Reproducible fine-tuning entry point for the approved factory dataset."""

import argparse
import hashlib
import json
import platform
from datetime import datetime, timezone
from pathlib import Path

import ultralytics
from ultralytics import YOLO


def parse_args(argv=None):
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
    parser.add_argument("--workers", type=int, default=0, help="0 avoids Windows worker RAM duplication")
    parser.add_argument("--patience", type=int, default=20)
    parser.add_argument("--freeze", type=int, default=0, help="Number of backbone layers to freeze")
    parser.add_argument("--optimizer", default="auto", choices=["auto", "AdamW", "SGD"])
    parser.add_argument("--lr0", type=float, default=0.01)
    parser.add_argument("--hsv-h", type=float, default=0.015)
    parser.add_argument("--save-period", type=int, default=5)
    parser.add_argument("--resume", action="store_true", help="Continue --model last.pt in its original run")
    return parser.parse_args(argv)


def training_options(args) -> dict:
    """Resolve project paths explicitly instead of inheriting Ultralytics runs_dir."""
    if args.epochs < 1 or args.batch < 1 or args.workers < 0 or args.freeze < 0:
        raise ValueError("epochs/batch must be positive; workers/freeze must be nonnegative")
    if args.name in {".", ".."} or Path(args.name).name != args.name:
        raise ValueError("name must be a single directory name")
    return dict(
        data=str(Path(args.data).resolve()), epochs=args.epochs, imgsz=args.imgsz,
        batch=args.batch, device=args.device, seed=args.seed, deterministic=True,
        project=str(Path(args.project).resolve()), name=args.name, exist_ok=True,
        patience=args.patience, plots=True, workers=args.workers, cache=False,
        freeze=args.freeze, optimizer=args.optimizer, lr0=args.lr0,
        hsv_h=args.hsv_h, save_period=args.save_period,
        close_mosaic=min(5, args.epochs),
    )


def main():
    args = parse_args()
    model_path = Path(args.model).resolve()
    if not model_path.is_file():
        raise SystemExit(f"Local base model is missing: {model_path}")
    if args.resume:
        YOLO(str(model_path)).train(resume=True, device=args.device, workers=args.workers)
        return
    options = training_options(args)
    if not Path(options["data"]).is_file():
        raise SystemExit(f"Dataset YAML is missing: {options['data']}")
    run_dir = Path(options["project"]) / args.name
    if run_dir.exists() and any(run_dir.iterdir()):
        raise SystemExit(f"Run already exists: {run_dir}; use a new name or --resume with last.pt")
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
        "training_options": options,
        "base_model_sha256": hashlib.sha256(model_path.read_bytes()).hexdigest(),
        "data_yaml_sha256": hashlib.sha256(Path(options["data"]).read_bytes()).hexdigest(),
    }
    (run_dir / "run_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    model = YOLO(str(model_path))
    model.train(**options)


if __name__ == "__main__":
    main()
