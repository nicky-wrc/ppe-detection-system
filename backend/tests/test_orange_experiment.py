import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

from scripts import run_orange_experiment


def test_resume_preserves_completed_work_and_runs_remaining_steps_once(tmp_path, monkeypatch):
    backend = tmp_path / "backend"
    job = backend / "experiments/trial-job"
    job.mkdir(parents=True)
    weights = backend / "experiments/trial/weights"
    weights.mkdir(parents=True)
    (weights / "last.pt").write_bytes(b"checkpoint")
    (job / "training.log").write_text("original interrupted log")
    (job / "status.json").write_text(json.dumps({
        "status": "running", "completed_steps": ["baseline_val"], "current_step": "training",
        "production_model_changed": False}))
    monkeypatch.setattr(run_orange_experiment, "__file__", str(backend / "scripts/run_orange_experiment.py"))
    monkeypatch.setattr(sys, "argv", ["run_orange_experiment.py", "--name", "trial", "--resume-job"])
    calls = []

    def subprocess_run(command, **kwargs):
        calls.append(command)
        if "evaluate_ppe.py" in command[1]:
            output = Path(command[command.index("--output") + 1])
            output.write_text(json.dumps({"per_class": [
                {"class_name": name, "ap50": 0.5, "recall": 0.6}
                for name in ("helmet", "safety-vest")]}))
        return SimpleNamespace(returncode=0)

    monkeypatch.setattr(run_orange_experiment.subprocess, "run", subprocess_run)
    run_orange_experiment.main()
    assert len(calls) == 3
    training = calls[0]
    assert "--resume" in training
    assert training[training.index("--model") + 1] == str(weights / "last.pt")
    assert all("--split" not in call or call[call.index("--split") + 1] == "test" for call in calls)
    assert (job / "training.log").read_text() == "original interrupted log"
    assert (job / "training_resume_1.log").is_file()
    status = json.loads((job / "status.json").read_text())
    assert status["status"] == "completed"
    assert status["completed_steps"] == ["baseline_val", "training", "baseline_test", "candidate_test"]
    assert status["production_model_changed"] is False


def test_completed_job_cannot_be_restarted(tmp_path, monkeypatch):
    backend = tmp_path / "backend"
    job = backend / "experiments/trial-job"
    job.mkdir(parents=True)
    content = json.dumps({"status": "completed", "completed_steps": []})
    (job / "status.json").write_text(content)
    monkeypatch.setattr(run_orange_experiment, "__file__", str(backend / "scripts/run_orange_experiment.py"))
    monkeypatch.setattr(sys, "argv", ["run_orange_experiment.py", "--name", "trial", "--resume-job"])
    with pytest.raises(SystemExit, match="already complete"):
        run_orange_experiment.main()
    assert (job / "status.json").read_text() == content
