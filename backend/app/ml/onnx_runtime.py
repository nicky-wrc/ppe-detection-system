"""CPU-only YOLOv8/YOLO11 raw-output adapter, without PyTorch imports.

Accepts reviewed batch-one FP32 detection exports with no embedded NMS. It keeps
the small result interface used by the existing hybrid association pipeline.
"""
from __future__ import annotations

import ast
from pathlib import Path
from types import SimpleNamespace

import cv2
import numpy as np


def letterbox(frame: np.ndarray, size: int) -> tuple[np.ndarray, float, tuple[int, int]]:
    """Square static-shape preprocessing matching Ultralytics letterbox."""
    if frame.ndim != 3 or frame.shape[2] != 3 or min(frame.shape[:2]) < 1:
        raise ValueError("Expected a nonempty BGR frame")
    height, width = frame.shape[:2]
    ratio = min(size / height, size / width)
    resized = (round(width * ratio), round(height * ratio))
    left = round((size - resized[0]) / 2 - 0.1)
    top = round((size - resized[1]) / 2 - 0.1)
    image = cv2.resize(frame, resized, interpolation=cv2.INTER_LINEAR)
    image = cv2.copyMakeBorder(image, top, size - resized[1] - top,
                              left, size - resized[0] - left,
                              cv2.BORDER_CONSTANT, value=(114, 114, 114))
    tensor = np.ascontiguousarray(image[:, :, ::-1].transpose(2, 0, 1)[None], dtype=np.float32)
    tensor /= 255.0
    return tensor, ratio, (left, top)


def decode_predictions(output: np.ndarray, class_count: int, confidence: float,
                       iou: float, classes: list[int] | None, ratio: float,
                       padding: tuple[int, int], shape: tuple[int, int],
                       max_det: int = 300) -> list[SimpleNamespace]:
    """Class-aware NMS and inverse letterbox, without retaining session outputs."""
    if output.ndim != 3 or output.shape[0] != 1 or output.shape[1] != class_count + 4:
        raise ValueError("Expected raw YOLOv8/11 output [1, 4+classes, anchors]")
    predictions = output[0].T
    ids = predictions[:, 4:].argmax(axis=1)
    scores = predictions[np.arange(len(predictions)), ids + 4]
    mask = np.isfinite(predictions).all(axis=1) & (scores > confidence)
    if classes is not None:
        mask &= np.isin(ids, classes)
    selected = predictions[mask, :4]
    scores, ids = scores[mask], ids[mask]
    boxes = np.empty_like(selected)
    boxes[:, :2] = selected[:, :2] - selected[:, 2:] / 2
    boxes[:, 2:] = selected[:, :2] + selected[:, 2:] / 2
    order = np.argsort(-scores, kind="stable")[:30000]
    keep: list[int] = []
    while order.size and len(keep) < max_det:
        current = int(order[0])
        keep.append(current)
        rest = order[1:]
        overlap = np.maximum(0, np.minimum(boxes[current, 2:], boxes[rest, 2:])
                             - np.maximum(boxes[current, :2], boxes[rest, :2]))
        intersection = overlap[:, 0] * overlap[:, 1]
        areas = np.maximum(0, boxes[:, 2] - boxes[:, 0]) * np.maximum(0, boxes[:, 3] - boxes[:, 1])
        union = areas[current] + areas[rest] - intersection
        ratios = intersection / np.maximum(union, 1e-9)
        order = rest[(ids[rest] != ids[current]) | (ratios <= iou)]
    height, width = shape
    results = []
    for index in keep:
        box = boxes[index].copy()
        box[[0, 2]] = np.clip((box[[0, 2]] - padding[0]) / ratio, 0, width)
        box[[1, 3]] = np.clip((box[[1, 3]] - padding[1]) / ratio, 0, height)
        results.append(SimpleNamespace(cls=np.array([ids[index]]),
                                       conf=np.array([scores[index]]), xyxy=box[None]))
    return results


class OnnxModel:
    """One persistent bounded CPU session per reviewed model."""

    def __init__(self, path: str | Path):
        import onnxruntime as ort

        options = ort.SessionOptions()
        options.intra_op_num_threads = 1
        options.inter_op_num_threads = 1
        options.enable_cpu_mem_arena = False
        options.enable_mem_pattern = False
        options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
        self.session = ort.InferenceSession(str(path), sess_options=options,
                                            providers=["CPUExecutionProvider"])
        inputs = self.session.get_inputs()
        if len(inputs) != 1 or inputs[0].type != "tensor(float)":
            raise ValueError("Only single-input FP32 exports are supported")
        shape = inputs[0].shape
        if len(shape) != 4 or shape[:2] != [1, 3] or shape[2] != shape[3] or shape[2] not in {320, 640}:
            raise ValueError("Only static batch-one 320/640 detection exports are supported")
        self.size = int(shape[2])
        self.input_name = inputs[0].name
        outputs = self.session.get_outputs()
        metadata = self.session.get_modelmeta().custom_metadata_map
        if metadata.get("task") != "detect":
            raise ValueError("Export must be a detection model")
        names = ast.literal_eval(metadata.get("names", "{}"))
        if not isinstance(names, dict) or not names or any(not isinstance(k, int) or not isinstance(v, str) for k, v in names.items()):
            raise ValueError("Invalid export class names")
        if sorted(names) != list(range(len(names))):
            raise ValueError("Export class IDs must be contiguous")
        self.names = names
        if len(outputs) != 1 or len(outputs[0].shape) != 3 or outputs[0].shape[:2] != [1, 4 + len(names)]:
            raise ValueError("Export must contain raw predictions, not embedded NMS")
        self.output_name = outputs[0].name

    def predict(self, source: np.ndarray | list[np.ndarray], conf: float, iou: float,
                imgsz: int, device: str, classes: list[int] | None = None,
                augment: bool = False, max_det: int = 300, verbose: bool = False):
        if imgsz != self.size or device != "cpu" or augment:
            raise ValueError("ONNX trial requires its fixed input size, CPU, no augmentation")
        frames = source if isinstance(source, list) else [source]
        results = []
        for frame in frames:
            tensor, ratio, padding = letterbox(frame, self.size)
            output = self.session.run([self.output_name], {self.input_name: tensor})[0]
            boxes = decode_predictions(output, len(self.names), conf, iou, classes,
                                       ratio, padding, frame.shape[:2], max_det)
            results.append(SimpleNamespace(boxes=boxes))
        return results
