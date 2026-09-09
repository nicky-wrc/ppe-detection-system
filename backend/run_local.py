"""Start the native local backend, with an opt-in Windows WMI workaround.

Run with --disable-wmi on machines where Python 3.12 platform queries hang.
The workaround affects this process only, not Windows services or Python files.
"""

import argparse
import json
import os
import sys
from pathlib import Path


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--disable-wmi", action="store_true")
    parser.add_argument("--check", action="store_true", help="Check model loading without starting API or cameras")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = parse_args(argv)
    if not 1 <= args.port <= 65535:
        raise SystemExit("Port must be between 1 and 65535")
    if args.disable_wmi and sys.platform == "win32":
        # Must precede third-party imports. CPython platform then uses its
        # existing non-WMI Windows fallback (sys.getwindowsversion / registry).
        # See https://github.com/python/cpython/issues/112278.
        sys.modules["_wmi"] = None
        print("Using process-local non-WMI Windows platform detection", flush=True)

    backend = Path(__file__).resolve().parent
    os.chdir(backend)
    from app.core.config import settings
    from app.ml.detector import get_detector

    if settings.ENVIRONMENT == "production":
        raise SystemExit("This launcher is for local development/test, not production")
    if settings.EVIDENCE_RETENTION_ENABLED and not args.check:
        raise SystemExit(
            "Local camera tests require EVIDENCE_RETENTION_ENABLED=false to preserve existing evidence"
        )
    detector = get_detector()
    expected_ppe = (backend / settings.MODEL_PATH).resolve()
    expected_person = (backend / settings.PERSON_MODEL_PATH).resolve()
    if detector.ppe_model_path != expected_ppe or detector.person_model_path != expected_person:
        raise SystemExit("Configured PPE/person model did not load; refusing to start with a fallback")
    print(json.dumps({
        "model_version": settings.MODEL_VERSION,
        **detector.engine_metadata,
        "evidence_cleanup_enabled": settings.EVIDENCE_RETENTION_ENABLED,
        "check_only": args.check,
    }), flush=True)
    if args.check:
        return
    import uvicorn

    # One process shares the preloaded detector with camera tasks. Reload and
    # multiple workers are intentionally not enabled for this local test.
    uvicorn.run("app.main:app", host=args.host, port=args.port)


if __name__ == "__main__":
    main()
