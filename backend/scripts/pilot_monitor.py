"""Record camera soak-test telemetry without storing camera frames."""

import argparse
import csv
import json
import os
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


def get_json(url: str, token: str):
    request = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.load(response)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:8000/api/v1")
    parser.add_argument("--hours", type=float, default=8)
    parser.add_argument("--interval", type=int, default=30)
    parser.add_argument("--minimum-fps", type=float, default=5)
    parser.add_argument("--expected-cameras", type=int, default=4)
    parser.add_argument("--output", default="pilot-soak.csv")
    args = parser.parse_args()

    token = os.environ.get("PPE_API_TOKEN")
    if not token:
        raise SystemExit("Set PPE_API_TOKEN to a valid admin or safety-officer JWT")

    output = Path(args.output)
    deadline = time.monotonic() + args.hours * 60 * 60
    failures = 0
    samples = 0
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["timestamp", "registered", "online", "minimum_fps", "total_frames", "events", "ok", "error"],
        )
        writer.writeheader()
        while time.monotonic() < deadline:
            row = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "registered": 0,
                "online": 0,
                "minimum_fps": 0,
                "total_frames": 0,
                "events": 0,
                "ok": False,
                "error": "",
            }
            try:
                cameras = get_json(f"{args.base_url}/cameras/", token)
                events = get_json(f"{args.base_url}/events/?page=1&per_page=1", token)
                online = [camera for camera in cameras if camera["is_online"]]
                minimum_fps = min((camera["measured_fps"] for camera in online), default=0)
                ok = len(online) >= args.expected_cameras and minimum_fps >= args.minimum_fps
                row.update(
                    registered=len(cameras),
                    online=len(online),
                    minimum_fps=minimum_fps,
                    total_frames=sum(camera["frames_analyzed"] for camera in cameras),
                    events=events["total"],
                    ok=ok,
                )
                failures += 0 if ok else 1
            except Exception as exc:
                row["error"] = str(exc)
                failures += 1
            writer.writerow(row)
            handle.flush()
            samples += 1
            time.sleep(args.interval)

    failure_rate = failures / max(1, samples)
    print(json.dumps({"samples": samples, "failures": failures, "failure_rate": failure_rate, "output": str(output)}))
    raise SystemExit(0 if failures == 0 else 1)


if __name__ == "__main__":
    main()
