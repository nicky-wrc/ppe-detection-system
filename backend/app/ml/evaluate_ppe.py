"""Evaluate one checkpoint on a locked validation or test split."""

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from ultralytics import YOLO


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--data", required=True)
    parser.add_argument("--split", choices=["val", "test"], default="test")
    parser.add_argument("--device", default="0")
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    model = YOLO(args.model)
    metrics = model.val(
        data=args.data,
        split=args.split,
        device=args.device,
        imgsz=args.imgsz,
        plots=True,
        save_json=True,
    )
    payload = {
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "model": str(Path(args.model).resolve()),
        "data": str(Path(args.data).resolve()),
        "split": args.split,
        "metrics": {key: float(value) for key, value in metrics.results_dict.items()},
        "class_names": model.names,
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
