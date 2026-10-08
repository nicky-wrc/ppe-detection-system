"""Additive FP32 export of the exact v4/YOLO11n checkpoints; no live config edits."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys


EXPECTED = {
    "ppe": "833fa3362afad19f27ff68ac44a52e598d26bd96f7f9f750b5469bd2382e0b9c",
    "person": "0ebbc80d4a7680d14987a577cd21342b65ecfd94632bd9a8da63ae6417644ee1",
}


def sha(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--tools", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(args.tools.resolve()))
    # Disable Ultralytics dependency auto-install; packages are operator-controlled.
    os.environ["YOLO_AUTOINSTALL"] = "false"
    from ultralytics import YOLO
    import onnx
    import torch

    torch.set_num_threads(1)
    output = args.output.resolve()
    if output.exists():
        raise ValueError("Output exists; choose a new directory, never overwrite artifacts")
    output.mkdir(parents=True)
    records = {}
    for key, source in {
        "ppe": root / "experiments/orange-ppe-yolo8m-20260917-v4/weights/best.pt",
        "person": root / "yolo11n.pt",
    }.items():
        if sha(source) != EXPECTED[key]:
            raise ValueError("Source checkpoint hash mismatch")
        copied = output / (key + ".pt")
        shutil.copy2(source, copied)
        exported = Path(YOLO(str(copied)).export(format="onnx", imgsz=320, batch=1,
            device="cpu", half=False, dynamic=False, simplify=False, nms=False, opset=17))
        onnx.checker.check_model(str(exported))
        if sha(source) != EXPECTED[key]:
            raise ValueError("Original checkpoint changed")
        records[key] = {"source_sha256": EXPECTED[key], "onnx_sha256": sha(exported),
                        "file": exported.name, "bytes": exported.stat().st_size}
    (output / "manifest.json").write_text(json.dumps({"imgsz": 320, "precision": "FP32",
        "models": records}, indent=2), encoding="utf-8")
    print(json.dumps(records, indent=2))


if __name__ == "__main__":
    main()
