"""Keep inference runtimes lazy: importing ONNX helpers must not load PyTorch."""


def __getattr__(name):
    if name in {"PPEDetector", "get_detector"}:
        from app.ml import detector
        return getattr(detector, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
