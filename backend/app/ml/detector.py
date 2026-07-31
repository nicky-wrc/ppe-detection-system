"""Hybrid PPE detection using a SH17 PPE model and a COCO person model."""

from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import torch
from PIL import Image, ImageDraw, ImageFont
from ultralytics import YOLO

from app.core.config import settings

logger = logging.getLogger(__name__)

SH17_CLASSES = {
    0: "person",
    1: "ear",
    2: "ear-mufs",
    3: "face",
    4: "face-guard",
    5: "face-mask",
    6: "foot",
    7: "tool",
    8: "glasses",
    9: "gloves",
    10: "helmet",
    11: "hands",
    12: "head",
    13: "medical-suit",
    14: "shoes",
    15: "safety-suit",
    16: "safety-vest",
}

SH17_THAI = {
    "person": "คน",
    "helmet": "หมวกนิรภัย",
    "safety-vest": "เสื้อสะท้อนแสง",
    "glasses": "แว่นตานิรภัย",
    "gloves": "ถุงมือ",
    "shoes": "รองเท้านิรภัย",
    "face-mask": "หน้ากาก",
    "face-guard": "กระบังหน้า",
    "ear-mufs": "ที่ครอบหู",
}

PPE_ITEMS = {"helmet", "safety-vest"}
PPE_CLASS_ALIASES = {"safety-suit": "safety-vest"}
DEFAULT_REQUIRED_PPE = ["helmet", "safety-vest"]
MIN_PERSON_HEIGHT_RATIO = 0.06
MIN_PERSON_AREA_RATIO = 0.0015
MIN_PERSON_ASPECT_RATIO = 0.18
MAX_PERSON_ASPECT_RATIO = 3.0
FRAME_EDGE_MARGIN_RATIO = 0.01
MIN_EDGE_PERSON_WIDTH_RATIO = 0.08
PERSON_SOURCE_NMS_IOU = 0.55
PPE_CROP_RESCUE_CONFIDENCE_RATIO = 0.60
MIN_UNCONFIRMED_SH17_AREA_RATIO = 0.01
MIN_UNCONFIRMED_SH17_HEIGHT_RATIO = 0.20
BROWSER_VIDEO_CODECS = (
    (".mp4", "avc1"),
    (".webm", "VP80"),
)


def open_browser_video_writer(
    output_base: str,
    fps: float,
    frame_size: tuple[int, int],
) -> tuple[cv2.VideoWriter | None, str | None]:
    """Open a browser-decodable annotated-video writer when the runtime supports one."""

    for extension, codec in BROWSER_VIDEO_CODECS:
        output_path = f"{output_base}{extension}"
        writer = cv2.VideoWriter(
            output_path,
            cv2.VideoWriter_fourcc(*codec),
            fps,
            frame_size,
        )
        if writer.isOpened():
            logger.info("Writing browser video with codec %s to %s", codec, output_path)
            return writer, output_path
        writer.release()
        Path(output_path).unlink(missing_ok=True)

    logger.warning("No browser-compatible OpenCV video encoder is available")
    return None, None


def canonical_ppe_class(class_name: str) -> str:
    """Map compatible SH17 labels to the pilot's helmet/vest contract."""

    return PPE_CLASS_ALIASES.get(class_name, class_name)


def crop_refinement_confidence(ppe_confidence: float) -> float:
    """Use a guarded lower floor for spatially constrained test-time augmentation."""

    return max(0.10, min(0.95, ppe_confidence * PPE_CROP_RESCUE_CONFIDENCE_RATIO))


def ppe_sensitivity_to_confidence(sensitivity: float) -> float:
    """Map the UI's 0-100 sensitivity to an actual PPE confidence floor.

    A larger sensitivity must accept lower-confidence PPE candidates. The old
    implementation incorrectly applied this value to person detections.
    """

    value = max(0.0, min(100.0, float(sensitivity)))
    return round(max(0.10, min(0.50, 0.45 - value * 0.0035)), 3)


def bbox_iou(first: list[float], second: list[float]) -> float:
    x1 = max(first[0], second[0])
    y1 = max(first[1], second[1])
    x2 = min(first[2], second[2])
    y2 = min(first[3], second[3])
    intersection = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    first_area = max(0.0, first[2] - first[0]) * max(0.0, first[3] - first[1])
    second_area = max(0.0, second[2] - second[0]) * max(0.0, second[3] - second[1])
    union = first_area + second_area - intersection
    return intersection / union if union > 0 else 0.0


def _bbox_area(bbox: list[float]) -> float:
    return max(0.0, bbox[2] - bbox[0]) * max(0.0, bbox[3] - bbox[1])


def _person_box_match_score(first: list[float], second: list[float]) -> float | None:
    """Match cross-model person boxes even when one model returns a tighter crop."""

    x1 = max(first[0], second[0])
    y1 = max(first[1], second[1])
    x2 = min(first[2], second[2])
    y2 = min(first[3], second[3])
    intersection = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    if intersection <= 0:
        return None

    first_area = _bbox_area(first)
    second_area = _bbox_area(second)
    if first_area <= 0 or second_area <= 0:
        return None

    overlap = bbox_iou(first, second)
    containment = intersection / min(first_area, second_area)
    first_center = ((first[0] + first[2]) / 2, (first[1] + first[3]) / 2)
    second_center = ((second[0] + second[2]) / 2, (second[1] + second[3]) / 2)
    center_distance = (
        (first_center[0] - second_center[0]) ** 2
        + (first_center[1] - second_center[1]) ** 2
    ) ** 0.5
    reference_diagonal = max(
        1.0,
        max(
            ((first[2] - first[0]) ** 2 + (first[3] - first[1]) ** 2) ** 0.5,
            ((second[2] - second[0]) ** 2 + (second[3] - second[1]) ** 2) ** 0.5,
        ),
    )
    normalized_distance = center_distance / reference_diagonal
    area_similarity = min(first_area, second_area) / max(first_area, second_area)

    if overlap >= 0.45:
        return overlap + containment * 0.20
    if containment >= 0.72 and normalized_distance <= 0.35:
        return containment * 0.75 + (1.0 - normalized_distance) * 0.20
    if overlap >= 0.15 and normalized_distance <= 0.20 and area_similarity >= 0.20:
        return overlap * 0.60 + (1.0 - normalized_distance) * 0.25 + area_similarity * 0.15
    return None


def fuse_person_detections(
    objects: list[dict[str, Any]],
    image_width: int,
    image_height: int,
) -> list[dict[str, Any]]:
    """Fuse SH17 and COCO person proposals while rejecting unusably small boxes.

    Cross-model boxes often describe the same partially visible person with low
    IoU because one model returns a full upper body and the other a tight crop.
    Matching by containment avoids duplicate people without merging two boxes
    emitted by the same model.
    """

    if image_width <= 0 or image_height <= 0:
        return []

    image_area = float(image_width * image_height)
    plausible: list[dict[str, Any]] = []
    for item in objects:
        bbox = item.get("bbox")
        if not isinstance(bbox, list) or len(bbox) != 4:
            continue
        width = max(0.0, bbox[2] - bbox[0])
        height = max(0.0, bbox[3] - bbox[1])
        area_ratio = width * height / image_area
        height_ratio = height / image_height
        width_ratio = width / image_width
        aspect_ratio = width / height if height > 0 else 0.0
        touches_horizontal_edge = (
            bbox[0] <= image_width * FRAME_EDGE_MARGIN_RATIO
            or bbox[2] >= image_width * (1.0 - FRAME_EDGE_MARGIN_RATIO)
        )
        if (
            width <= 0
            or height <= 0
            or height_ratio < MIN_PERSON_HEIGHT_RATIO
            or area_ratio < MIN_PERSON_AREA_RATIO
            or aspect_ratio < MIN_PERSON_ASPECT_RATIO
            or aspect_ratio > MAX_PERSON_ASPECT_RATIO
            or (touches_horizontal_edge and width_ratio < MIN_EDGE_PERSON_WIDTH_RATIO)
        ):
            continue
        plausible.append(item)

    by_source: dict[str, list[dict[str, Any]]] = {}
    for index, item in enumerate(plausible):
        source_key = str(item.get("source") or f"unknown-{index}")
        by_source.setdefault(source_key, []).append(item)
    plausible = [
        item
        for source_items in by_source.values()
        for item in non_max_suppression(source_items, iou_threshold=PERSON_SOURCE_NMS_IOU)
    ]
    candidates: list[tuple[float, int, int]] = []
    for first_index, first in enumerate(plausible):
        first_source = first.get("source")
        for second_index in range(first_index + 1, len(plausible)):
            second = plausible[second_index]
            second_source = second.get("source")
            if not first_source or not second_source or first_source == second_source:
                continue
            score = _person_box_match_score(first["bbox"], second["bbox"])
            if score is not None:
                candidates.append((score, first_index, second_index))

    used: set[int] = set()
    fused: list[dict[str, Any]] = []
    for _, first_index, second_index in sorted(candidates, reverse=True):
        if first_index in used or second_index in used:
            continue
        first = plausible[first_index]
        second = plausible[second_index]
        larger = first if _bbox_area(first["bbox"]) >= _bbox_area(second["bbox"]) else second
        sources = sorted({str(first["source"]), str(second["source"])})
        fused.append({
            **larger,
            "confidence": max(float(first["confidence"]), float(second["confidence"])),
            "source": "+".join(sources),
        })
        used.update({first_index, second_index})

    for index, item in enumerate(plausible):
        if index in used:
            continue
        if item.get("source") == "yolov8-sh17":
            item_area_ratio = _bbox_area(item["bbox"]) / image_area
            item_height_ratio = (item["bbox"][3] - item["bbox"][1]) / image_height
            if (
                item_area_ratio < MIN_UNCONFIRMED_SH17_AREA_RATIO
                and item_height_ratio < MIN_UNCONFIRMED_SH17_HEIGHT_RATIO
            ):
                continue
        fused.append(item)
    return sorted(fused, key=lambda item: item["confidence"], reverse=True)


def non_max_suppression(
    objects: list[dict[str, Any]],
    iou_threshold: float = 0.55,
    class_aware: bool = False,
) -> list[dict[str, Any]]:
    """Deduplicate detections from full-frame, person-assist, and crop passes."""

    kept: list[dict[str, Any]] = []
    for candidate in sorted(objects, key=lambda item: item["confidence"], reverse=True):
        duplicate = False
        for existing in kept:
            if class_aware and candidate.get("class") != existing.get("class"):
                continue
            if bbox_iou(candidate["bbox"], existing["bbox"]) >= iou_threshold:
                duplicate = True
                break
        if not duplicate:
            kept.append(candidate)
    return kept


class PPEDetector:
    """Detect people with YOLO11 and required PPE with a SH17 YOLOv8 model."""

    CONF_THRESHOLD = 0.20
    PERSON_CONF = 0.30
    IOU_THRESHOLD = 0.45

    def __init__(self) -> None:
        self.ppe_model: YOLO | None = None
        self.person_model: YOLO | None = None
        self.ppe_model_path: Path | None = None
        self.person_model_path: Path | None = None
        self.font: ImageFont.FreeTypeFont | ImageFont.ImageFont | None = None
        self.font_small: ImageFont.FreeTypeFont | ImageFont.ImageFont | None = None
        self.device = self._resolve_device(settings.INFERENCE_DEVICE)
        self.crop_refinement_enabled = bool(settings.PPE_CROP_REFINEMENT and self.device != "cpu")
        self._load_models()
        self._load_font()

    @staticmethod
    def _resolve_device(configured: str) -> str:
        requested = configured.strip().lower()
        if requested == "auto":
            return "0" if torch.cuda.is_available() else "cpu"
        if requested not in {"cpu", "mps"} and not torch.cuda.is_available():
            logger.warning("CUDA device %s was requested but is unavailable; using CPU", configured)
            return "cpu"
        return configured

    @property
    def engine_metadata(self) -> dict[str, Any]:
        return {
            "ppe_model": self.ppe_model_path.name if self.ppe_model_path else None,
            "person_model": self.person_model_path.name if self.person_model_path else None,
            "device": "cuda:0" if self.device == "0" else self.device,
            "crop_refinement": self.crop_refinement_enabled,
            "low_light_enhancement": bool(settings.LOW_LIGHT_ENHANCEMENT),
        }

    @staticmethod
    def _model_names(model: YOLO) -> dict[int, str]:
        names = model.names
        if isinstance(names, dict):
            return {int(key): str(value) for key, value in names.items()}
        return {index: str(value) for index, value in enumerate(names)}

    @staticmethod
    def _resolve_model_path(model_dir: Path, configured: str) -> Path:
        path = Path(configured)
        return path if path.is_absolute() else model_dir / path

    def _load_models(self) -> None:
        model_dir = Path(__file__).resolve().parent.parent.parent
        configured_ppe = self._resolve_model_path(model_dir, settings.MODEL_PATH)
        candidates = [configured_ppe, model_dir / "yolo8m.pt", model_dir / "yolo8s.pt"]
        seen: set[Path] = set()

        for candidate in candidates:
            path = candidate.resolve()
            if path in seen:
                continue
            seen.add(path)
            if not path.exists():
                continue
            try:
                model = YOLO(str(path))
                available = set(self._model_names(model).values())
                if not {"person", "helmet", "safety-vest"}.issubset(available):
                    logger.warning("Skipping incompatible PPE model %s: SH17 PPE classes are missing", path.name)
                    continue
                self.ppe_model = model
                self.ppe_model_path = path
                logger.info("Loaded PPE model %s on %s", path.name, self.device)
                break
            except (OSError, RuntimeError, ValueError):
                logger.exception("Failed to load PPE model %s", path)

        person_path = self._resolve_model_path(model_dir, settings.PERSON_MODEL_PATH).resolve()
        if person_path.exists():
            try:
                model = YOLO(str(person_path))
                if "person" not in set(self._model_names(model).values()):
                    logger.warning("Skipping person-assist model %s: person class is missing", person_path.name)
                else:
                    self.person_model = model
                    self.person_model_path = person_path
                    logger.info("Loaded person-assist model %s on %s", person_path.name, self.device)
            except (OSError, RuntimeError, ValueError):
                logger.exception("Failed to load person-assist model %s", person_path)
        else:
            logger.warning("Person-assist model does not exist: %s", person_path)

        if self.ppe_model is None:
            logger.error("No compatible SH17 PPE model was found under %s", model_dir)
        if settings.PPE_CROP_REFINEMENT and not self.crop_refinement_enabled:
            logger.warning("PPE crop refinement is disabled on CPU to protect camera latency")

    def _load_font(self) -> None:
        for font_path in [
            "C:/Windows/Fonts/tahoma.ttf",
            "C:/Windows/Fonts/THSarabunNew.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ]:
            try:
                if Path(font_path).exists():
                    self.font = ImageFont.truetype(font_path, 24)
                    self.font_small = ImageFont.truetype(font_path, 18)
                    return
            except OSError:
                logger.debug("Could not load font %s", font_path, exc_info=True)
        self.font = ImageFont.load_default()
        self.font_small = ImageFont.load_default()

    @staticmethod
    def enhance_low_light(image: np.ndarray, threshold: float) -> tuple[np.ndarray, float, bool]:
        """Apply CLAHE to luminance only when the frame is genuinely dark."""

        if image.size == 0:
            return image, 0.0, False
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        luminance, channel_a, channel_b = cv2.split(lab)
        mean_luma = float(np.mean(luminance))
        if mean_luma >= threshold:
            return image, mean_luma, False
        clahe = cv2.createCLAHE(clipLimit=2.2, tileGridSize=(8, 8))
        enhanced_luma = clahe.apply(luminance)
        enhanced = cv2.cvtColor(cv2.merge((enhanced_luma, channel_a, channel_b)), cv2.COLOR_LAB2BGR)
        return enhanced, mean_luma, True

    def _predict(
        self,
        model: YOLO,
        source: np.ndarray | list[np.ndarray],
        confidence: float,
        classes: list[int] | None = None,
        augment: bool = False,
    ) -> list[Any]:
        return model.predict(
            source=source,
            conf=max(0.05, min(0.95, confidence)),
            iou=self.IOU_THRESHOLD,
            imgsz=max(320, min(1280, settings.INFERENCE_IMAGE_SIZE)),
            device=self.device,
            classes=classes,
            augment=augment,
            max_det=300,
            verbose=False,
        )

    def _parse_ppe_result(
        self,
        result: Any,
        ppe_confidence: float,
        person_confidence: float,
        offset: tuple[int, int] = (0, 0),
        include_person: bool = True,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        persons: list[dict[str, Any]] = []
        ppe: list[dict[str, Any]] = []
        if result.boxes is None or self.ppe_model is None:
            return persons, ppe
        names = self._model_names(self.ppe_model)
        offset_x, offset_y = offset
        for box in result.boxes:
            class_id = int(box.cls[0])
            confidence = float(box.conf[0])
            class_name = names.get(class_id, SH17_CLASSES.get(class_id, f"class_{class_id}"))
            canonical_class = canonical_ppe_class(class_name)
            x1, y1, x2, y2 = [float(value) for value in box.xyxy[0].tolist()]
            bbox = [x1 + offset_x, y1 + offset_y, x2 + offset_x, y2 + offset_y]
            if include_person and class_name == "person" and confidence >= person_confidence:
                persons.append({"bbox": bbox, "confidence": confidence, "source": "yolov8-sh17"})
            elif canonical_class in PPE_ITEMS and confidence >= ppe_confidence:
                ppe.append({
                    "class": canonical_class,
                    "source_class": class_name,
                    "bbox": bbox,
                    "confidence": confidence,
                    "source": "yolov8-sh17",
                })
        return persons, ppe

    def _person_assist(self, frame: np.ndarray, confidence: float) -> list[dict[str, Any]]:
        if self.person_model is None:
            return []
        names = self._model_names(self.person_model)
        person_ids = [class_id for class_id, name in names.items() if name == "person"]
        results = self._predict(self.person_model, frame, confidence, classes=person_ids)
        persons: list[dict[str, Any]] = []
        for result in results:
            if result.boxes is None:
                continue
            for box in result.boxes:
                score = float(box.conf[0])
                if score < confidence:
                    continue
                persons.append({
                    "bbox": [float(value) for value in box.xyxy[0].tolist()],
                    "confidence": score,
                    "source": "yolo11-person",
                })
        return persons

    def _refine_ppe_in_person_crops(
        self,
        frame: np.ndarray,
        persons: list[dict[str, Any]],
        ppe_confidence: float,
    ) -> list[dict[str, Any]]:
        if not self.crop_refinement_enabled or self.ppe_model is None or not persons:
            return []
        height, width = frame.shape[:2]
        crops: list[np.ndarray] = []
        offsets: list[tuple[int, int]] = []
        ranked = sorted(persons, key=lambda item: item["confidence"], reverse=True)
        for person in ranked[: max(1, settings.PPE_CROP_MAX_PERSONS)]:
            x1, y1, x2, y2 = person["bbox"]
            person_width = x2 - x1
            person_height = y2 - y1
            crop_x1 = max(0, int(x1 - person_width * 0.12))
            crop_y1 = max(0, int(y1 - person_height * 0.18))
            crop_x2 = min(width, int(x2 + person_width * 0.12))
            crop_y2 = min(height, int(y2 + person_height * 0.05))
            if crop_x2 - crop_x1 < 48 or crop_y2 - crop_y1 < 80:
                continue
            crops.append(frame[crop_y1:crop_y2, crop_x1:crop_x2])
            offsets.append((crop_x1, crop_y1))
        if not crops:
            return []

        refinement_confidence = crop_refinement_confidence(ppe_confidence)
        refined: list[dict[str, Any]] = []
        for result, offset in zip(
            self._predict(
                self.ppe_model,
                crops,
                refinement_confidence,
                augment=True,
            ),
            offsets,
        ):
            _, ppe = self._parse_ppe_result(
                result,
                ppe_confidence=refinement_confidence,
                person_confidence=1.0,
                offset=offset,
                include_person=False,
            )
            for item in ppe:
                item["source"] = "yolov8-person-crop"
            refined.extend(ppe)
        return refined

    @staticmethod
    def _ppe_person_score(ppe: dict[str, Any], person: dict[str, Any]) -> float | None:
        px1, py1, px2, py2 = person["bbox"]
        ex1, ey1, ex2, ey2 = ppe["bbox"]
        person_width = max(1.0, px2 - px1)
        person_height = max(1.0, py2 - py1)
        center_x = (ex1 + ex2) / 2
        center_y = (ey1 + ey2) / 2

        if ppe["class"] == "helmet":
            region = [
                px1 - person_width * 0.25,
                py1 - person_height * 0.20,
                px2 + person_width * 0.25,
                py1 + person_height * 0.55,
            ]
            anchor_x, anchor_y = (px1 + px2) / 2, py1 + person_height * 0.08
        else:
            region = [
                px1 - person_width * 0.18,
                py1 + person_height * 0.10,
                px2 + person_width * 0.18,
                py1 + person_height * 0.72,
            ]
            anchor_x, anchor_y = (px1 + px2) / 2, py1 + person_height * 0.40

        center_inside = region[0] <= center_x <= region[2] and region[1] <= center_y <= region[3]
        intersection_x1 = max(ex1, region[0])
        intersection_y1 = max(ey1, region[1])
        intersection_x2 = min(ex2, region[2])
        intersection_y2 = min(ey2, region[3])
        intersection = max(0.0, intersection_x2 - intersection_x1) * max(0.0, intersection_y2 - intersection_y1)
        ppe_area = max(1.0, (ex2 - ex1) * (ey2 - ey1))
        coverage = intersection / ppe_area
        if not center_inside and coverage < 0.45:
            return None

        distance = ((center_x - anchor_x) ** 2 + (center_y - anchor_y) ** 2) ** 0.5
        diagonal = (person_width**2 + person_height**2) ** 0.5
        proximity = max(0.0, 1.0 - distance / max(1.0, diagonal * 0.65))
        return proximity * 0.55 + min(1.0, coverage) * 0.25 + ppe["confidence"] * 0.20

    def _associate_ppe(
        self,
        raw_persons: list[dict[str, Any]],
        ppe_objects: list[dict[str, Any]],
        img_h: int,
        required: list[str],
    ) -> list[dict[str, Any]]:
        persons: list[dict[str, Any]] = []
        for raw_person in non_max_suppression(raw_persons, iou_threshold=0.55):
            x1, y1, x2, y2 = raw_person["bbox"]
            if x2 <= x1 or y2 <= y1 or (img_h > 0 and (y2 - y1) / img_h < 0.06):
                continue
            persons.append({
                "bbox": raw_person["bbox"],
                "confidence": raw_person["confidence"],
                "source": raw_person.get("source"),
                "found_ppe": {},
            })

        for ppe in ppe_objects:
            best_index = -1
            best_score = -1.0
            for index, person in enumerate(persons):
                score = self._ppe_person_score(ppe, person)
                if score is not None and score > best_score:
                    best_index = index
                    best_score = score
            if best_index >= 0:
                existing = persons[best_index]["found_ppe"].get(ppe["class"])
                if existing is None or ppe["confidence"] > existing:
                    persons[best_index]["found_ppe"][ppe["class"]] = ppe["confidence"]

        result: list[dict[str, Any]] = []
        for person in persons:
            wearing = [item for item in required if item in person["found_ppe"]]
            not_wearing = [item for item in required if item not in person["found_ppe"]]
            result.append({
                "id": len(result) + 1,
                "bbox": person["bbox"],
                "confidence": person["confidence"],
                "wearing": wearing,
                "wearing_confidences": {
                    item: round(person["found_ppe"][item], 4) for item in wearing
                },
                "not_wearing": not_wearing,
                "is_compliant": not not_wearing,
            })
        return result

    def _build_result(
        self,
        persons: list[dict[str, Any]],
        processing_time_ms: float,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        violation_count = sum(not person["is_compliant"] for person in persons)
        violations: list[str] = []
        for person in persons:
            for item in person["not_wearing"]:
                label = f"ไม่สวม{SH17_THAI.get(item, item)}"
                if label not in violations:
                    violations.append(label)

        person_count = len(persons)
        if person_count == 0:
            status, message = "no_person", "ไม่พบคนในภาพ"
        elif violation_count == 0:
            status, message = "compliant", f"พบ {person_count} คน — สวม PPE ครบทุกคน"
        else:
            status = "violation"
            message = "ตรวจพบ: " + " และ ".join(violations)

        runtime = {**self.engine_metadata, **(metadata or {})}
        return {
            "detected_objects": [
                {
                    "class_id": 0,
                    "class_name": "person",
                    "class_name_thai": "คน",
                    "confidence": person["confidence"],
                    "bbox": person["bbox"],
                    "is_violation": not person["is_compliant"],
                    "is_person": True,
                }
                for person in persons
            ],
            "persons": persons,
            "violations": violations,
            "person_count": person_count,
            "violation_count": violation_count,
            "has_violation": violation_count > 0,
            "processing_time_ms": round(processing_time_ms, 2),
            "runtime": runtime,
            "summary": {
                "message": message,
                "status": status,
                "total_persons": person_count,
                "compliant_persons": person_count - violation_count,
                "non_compliant_persons": violation_count,
            },
        }

    def detect(
        self,
        image: np.ndarray,
        required_ppe: list[str] | None = None,
        confidence_threshold: float | None = None,
        person_confidence: float | None = None,
    ) -> dict[str, Any]:
        started = time.perf_counter()
        if self.ppe_model is None:
            return self._empty_result()

        required = required_ppe or DEFAULT_REQUIRED_PPE
        ppe_confidence = max(
            0.05,
            min(0.95, confidence_threshold if confidence_threshold is not None else settings.CONFIDENCE_THRESHOLD),
        )
        minimum_person_confidence = max(
            0.05,
            min(0.95, person_confidence if person_confidence is not None else settings.PERSON_CONFIDENCE_THRESHOLD),
        )
        if settings.LOW_LIGHT_ENHANCEMENT:
            inference_frame, mean_luma, enhanced = self.enhance_low_light(
                image,
                settings.LOW_LIGHT_LUMA_THRESHOLD,
            )
        else:
            inference_frame, mean_luma, enhanced = image, -1.0, False

        full_frame_results = self._predict(
            self.ppe_model,
            inference_frame,
            min(ppe_confidence, minimum_person_confidence),
        )
        raw_persons: list[dict[str, Any]] = []
        ppe_objects: list[dict[str, Any]] = []
        for result in full_frame_results:
            persons, ppe = self._parse_ppe_result(
                result,
                ppe_confidence=ppe_confidence,
                person_confidence=minimum_person_confidence,
            )
            raw_persons.extend(persons)
            ppe_objects.extend(ppe)

        raw_persons.extend(self._person_assist(inference_frame, minimum_person_confidence))
        raw_persons = fuse_person_detections(
            raw_persons,
            image_width=image.shape[1],
            image_height=image.shape[0],
        )
        ppe_objects.extend(
            self._refine_ppe_in_person_crops(inference_frame, raw_persons, ppe_confidence)
        )
        ppe_objects = non_max_suppression(ppe_objects, iou_threshold=0.50, class_aware=True)
        persons = self._associate_ppe(raw_persons, ppe_objects, image.shape[0], required)

        return self._build_result(
            persons,
            (time.perf_counter() - started) * 1000,
            {
                "mean_luma": round(mean_luma, 2) if mean_luma >= 0 else None,
                "low_light_enhanced": enhanced,
                "ppe_candidates": len(ppe_objects),
            },
        )

    def _empty_result(self) -> dict[str, Any]:
        result = self._build_result([], 0)
        result["summary"] = {
            "message": "ไม่สามารถประมวลผลได้ — ไม่พบโมเดล PPE ที่เข้ากันได้",
            "status": "error",
        }
        return result

    def draw_detections(self, image: np.ndarray, detection: dict[str, Any]) -> np.ndarray:
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        canvas = Image.fromarray(rgb)
        status = detection.get("summary", {}).get("status", "")
        compliant_color = (35, 175, 96)
        violation_color = (250, 36, 60)
        neutral_color = (74, 85, 104)
        banner_color = (
            compliant_color if status == "compliant" else violation_color if status == "violation" else neutral_color
        )

        overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        ImageDraw.Draw(overlay).rectangle([(0, 0), (canvas.width, 50)], fill=(*banner_color, 220))
        canvas = Image.alpha_composite(canvas.convert("RGBA"), overlay).convert("RGB")
        draw = ImageDraw.Draw(canvas)
        self._draw_text(draw, (15, 10), detection.get("summary", {}).get("message", "PPE Detection"), self.font, (255, 255, 255))

        for person in detection.get("persons", []):
            x1, y1, x2, y2 = map(int, person["bbox"])
            color = compliant_color if person["is_compliant"] else violation_color
            draw.rectangle([(x1, y1), (x2, y2)], outline=color, width=3)
            confidence = int(person["confidence"] * 100)
            status_label = "ปลอดภัย" if person["is_compliant"] else "ไม่ครบ PPE"
            self._draw_label(draw, x1, y1 - 28, f"คน {person['id']} · {confidence}% · {status_label}", self.font_small, color)
            label_y = y1 + 6
            for item in person.get("wearing", []):
                score = person.get("wearing_confidences", {}).get(item)
                suffix = f" {score * 100:.0f}%" if score is not None else ""
                self._draw_label(draw, x1 + 5, label_y, f"✓ {SH17_THAI.get(item, item)}{suffix}", self.font_small, compliant_color)
                label_y += 26
            for item in person.get("not_wearing", []):
                self._draw_label(draw, x1 + 5, label_y, f"✕ ไม่พบ{SH17_THAI.get(item, item)}", self.font_small, violation_color)
                label_y += 26

        return cv2.cvtColor(np.asarray(canvas), cv2.COLOR_RGB2BGR)

    @staticmethod
    def _draw_text(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, font: Any, fill: tuple[int, int, int]) -> None:
        draw.text(xy, text, font=font, fill=fill)

    @staticmethod
    def _draw_label(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, font: Any, bg_color: tuple[int, int, int]) -> None:
        text_box = draw.textbbox((x, y), text, font=font)
        draw.rectangle(
            [(text_box[0] - 4, text_box[1] - 2), (text_box[2] + 4, text_box[3] + 2)],
            fill=bg_color,
        )
        draw.text((x, y), text, font=font, fill=(255, 255, 255))

    def process_image(
        self,
        image_path: str,
        output_path: str,
        required_ppe: list[str] | None = None,
        confidence_threshold: float | None = None,
        person_confidence: float | None = None,
    ) -> dict[str, Any]:
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"ไม่สามารถอ่านภาพได้: {image_path}")
        result = self.detect(image, required_ppe, confidence_threshold, person_confidence)
        if not cv2.imwrite(output_path, self.draw_detections(image, result)):
            raise OSError(f"ไม่สามารถบันทึกผลลัพธ์ได้: {output_path}")
        return result

    def process_video(
        self,
        video_path: str,
        output_path: str,
        required_ppe: list[str] | None = None,
        confidence_threshold: float | None = None,
        person_confidence: float | None = None,
    ) -> dict[str, Any]:
        """Analyze a bounded sample and stream annotations to disk without retaining all frames."""

        started = time.perf_counter()
        capture = cv2.VideoCapture(video_path)
        if not capture.isOpened():
            capture.release()
            raise ValueError("ไม่สามารถเปิดวิดีโอได้")

        frame_stride = max(1, settings.VIDEO_FRAME_STRIDE)
        max_frames = max(1, settings.VIDEO_MAX_ANALYZED_FRAMES)
        source_fps = float(capture.get(cv2.CAP_PROP_FPS) or 24.0)
        output_fps = max(1.0, min(15.0, source_fps / frame_stride))
        output_base = str(Path(output_path).with_suffix(""))
        output_video_path: str | None = None
        best_frame_path = f"{output_base}_best.jpg"
        writer: cv2.VideoWriter | None = None
        writer_attempted = False
        processed = 0
        source_index = 0
        best_result: dict[str, Any] | None = None
        best_frame: np.ndarray | None = None
        all_violations: set[str] = set()

        try:
            while processed < max_frames:
                ok, frame = capture.read()
                if not ok or frame is None:
                    break
                source_index += 1
                if (source_index - 1) % frame_stride != 0:
                    continue

                result = self.detect(frame, required_ppe, confidence_threshold, person_confidence)
                annotated = self.draw_detections(frame, result)
                if not writer_attempted:
                    writer_attempted = True
                    height, width = annotated.shape[:2]
                    writer, output_video_path = open_browser_video_writer(
                        output_base,
                        output_fps,
                        (width, height),
                    )
                if writer is not None:
                    writer.write(annotated)

                score = result["person_count"] * 10 + result["violation_count"]
                best_score = (
                    best_result["person_count"] * 10 + best_result["violation_count"]
                    if best_result is not None
                    else -1
                )
                if score > best_score:
                    best_result = result
                    best_frame = annotated.copy()
                all_violations.update(result.get("violations", []))
                processed += 1
        finally:
            capture.release()
            if writer is not None:
                writer.release()

        if processed == 0 or best_result is None or best_frame is None:
            raise ValueError("ไม่พบเฟรมที่อ่านได้จากวิดีโอ")
        if not cv2.imwrite(best_frame_path, best_frame):
            raise OSError(f"ไม่สามารถบันทึก best frame ได้: {best_frame_path}")
        if (
            output_video_path is None
            or not os.path.exists(output_video_path)
            or os.path.getsize(output_video_path) < 1000
        ):
            output_video_path = best_frame_path

        final_result = {**best_result}
        final_result.update({
            "violations": sorted(all_violations),
            "has_violation": best_result["violation_count"] > 0,
            "processing_time_ms": round((time.perf_counter() - started) * 1000, 2),
            "output_video_path": output_video_path,
            "best_frame_path": best_frame_path,
            "frames_processed": processed,
        })
        logger.info(
            "Processed video %s: %s sampled frames in %.0f ms",
            video_path,
            processed,
            final_result["processing_time_ms"],
        )
        return final_result


_detector: PPEDetector | None = None


def get_detector() -> PPEDetector:
    global _detector
    if _detector is None:
        _detector = PPEDetector()
    return _detector


def reset_detector() -> None:
    global _detector
    _detector = None
