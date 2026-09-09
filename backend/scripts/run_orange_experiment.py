"""Run an isolated public-data PPE experiment and record real process outcomes.

The candidate is not promoted to the application. Person labels and an
independent target-camera orange test set are absent from this public dataset.
"""

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name", required=True)
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--resume-job", action="store_true", help="Continue an interrupted job from last.pt")
    args = parser.parse_args()
    if Path(args.name).name != args.name or args.name in {".", ".."}:
        raise SystemExit("name must be a directory name")
    backend = Path(__file__).resolve().parents[1]
    project = backend / "experiments"
    run_dir = project / args.name
    job_dir = project / f"{args.name}-job"
    if not args.resume_job and (run_dir.exists() or job_dir.exists()):
        raise SystemExit("Use a new experiment name; existing results are preserved")
    if args.resume_job and not (job_dir / "status.json").is_file():
        raise SystemExit("No existing job status to resume")
    assets = project / "training-assets"
    assets.mkdir(parents=True, exist_ok=True)
    job_dir.mkdir(exist_ok=args.resume_job)
    env = os.environ.copy()
    env["MPLCONFIGDIR"] = str(assets / "matplotlib")
    env["YOLO_CONFIG_DIR"] = str(assets / "ultralytics")
    Path(env["MPLCONFIGDIR"]).mkdir(exist_ok=True)
    Path(env["YOLO_CONFIG_DIR"]).mkdir(exist_ok=True)
    env["PYTHONUNBUFFERED"] = "1"
    env["OMP_NUM_THREADS"] = "4"
    env["MKL_NUM_THREADS"] = "4"
    data = backend / "datasets/hardhat-vest-v3-sh17/data-focused.yaml"
    base = backend / "yolo8m.pt"
    candidate = run_dir / "weights/best.pt"
    evaluator = backend / "app/ml/evaluate_ppe.py"
    status: dict = {"name": args.name, "started_at": datetime.now(timezone.utc).isoformat(),
                    "status": "running", "run_dir": str(run_dir), "completed_steps": [],
                    "limitations": ["No person labels", "No independently labeled orange-camera test set",
                                     "Public source splits may contain related scenes"],
                    "production_model_changed": False}
    if args.resume_job:
        status = json.loads((job_dir / "status.json").read_text(encoding="utf-8"))
        if status["status"] == "completed":
            raise SystemExit("Job is already complete; existing reports are preserved")
        if "training" not in status["completed_steps"] and not (run_dir / "weights/last.pt").is_file():
            raise SystemExit("No training checkpoint to resume")
        status.setdefault("resumptions", []).append({
            "at": datetime.now(timezone.utc).isoformat(),
            "previous_step": status.get("current_step"),
            "previous_status": status["status"],
        })
        status["status"] = "running"
        status.pop("exit_code", None)

    def save_status() -> None:
        temporary = job_dir / "status.tmp"
        temporary.write_text(json.dumps(status, indent=2), encoding="utf-8")
        temporary.replace(job_dir / "status.json")

    def run(step: str, command: list[str]) -> None:
        if step in status["completed_steps"]:
            print(f"Preserving completed step: {step}", flush=True)
            return
        status.update(current_step=step, command=command)
        save_status()
        print(f"Starting {step}", flush=True)
        suffix = f"_resume_{len(status.get('resumptions', []))}" if args.resume_job else ""
        log_path = job_dir / f"{step}{suffix}.log"
        status["current_log"] = str(log_path)
        save_status()
        with log_path.open("x", encoding="utf-8") as log:
            result = subprocess.run(command, cwd=assets, env=env, stdout=log, stderr=subprocess.STDOUT)
        if result.returncode:
            status.update(status="failed", exit_code=result.returncode)
            save_status()
            raise SystemExit(f"{step} failed ({result.returncode}); see {log_path}")
        status["completed_steps"].append(step)
        save_status()

    def evaluate(step: str, model: Path, split: str) -> None:
        run(step, [sys.executable, str(evaluator), "--model", str(model), "--data", str(data),
                   "--split", split, "--device", "0", "--imgsz", "640", "--batch", "8",
                   "--workers", "0", "--output", str(job_dir / f"{step}.json")])

    evaluate("baseline_val", base, "val")
    if args.resume_job:
        run("training", [sys.executable, str(backend / "app/ml/train_ppe.py"),
                         "--data", str(data), "--model", str(run_dir / "weights/last.pt"),
                         "--name", args.name, "--resume", "--workers", "0", "--device", "0"])
    run("training", [sys.executable, str(backend / "app/ml/train_ppe.py"),
                     "--data", str(data), "--model", str(base), "--epochs", str(args.epochs),
                     "--imgsz", "640", "--batch", "16", "--workers", "0", "--freeze", "10",
                     "--optimizer", "AdamW", "--lr0", "0.0003", "--hsv-h", "0.025",
                     "--patience", "8", "--save-period", "5", "--device", "0",
                     "--project", str(project), "--name", args.name])
    evaluate("baseline_test", base, "test")
    evaluate("candidate_test", candidate, "test")
    baseline = json.loads((job_dir / "baseline_test.json").read_text())
    trained = json.loads((job_dir / "candidate_test.json").read_text())
    comparison = {}
    for name in ("helmet", "safety-vest"):
        before = next(row for row in baseline["per_class"] if row["class_name"] == name)
        after = next(row for row in trained["per_class"] if row["class_name"] == name)
        comparison[name] = {"baseline": before, "candidate": after,
                            "delta_ap50": after["ap50"] - before["ap50"],
                            "delta_recall": after["recall"] - before["recall"]}
    (job_dir / "comparison.json").write_text(json.dumps(comparison, indent=2), encoding="utf-8")
    status.update(status="completed", completed_at=datetime.now(timezone.utc).isoformat(),
                  candidate=str(candidate), comparison=comparison)
    save_status()
    print(json.dumps(status, indent=2), flush=True)


if __name__ == "__main__":
    main()
