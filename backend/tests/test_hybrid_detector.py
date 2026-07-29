import numpy as np

from app.ml.detector import (
    PPEDetector,
    non_max_suppression,
    ppe_sensitivity_to_confidence,
)


def test_ppe_sensitivity_lowers_ppe_confidence_floor():
    assert ppe_sensitivity_to_confidence(20) == 0.38
    assert ppe_sensitivity_to_confidence(60) == 0.24
    assert ppe_sensitivity_to_confidence(100) == 0.1


def test_low_light_enhancement_only_changes_dark_frames():
    dark = np.full((96, 96, 3), 18, dtype=np.uint8)
    enhanced, mean_luma, changed = PPEDetector.enhance_low_light(dark, threshold=72)

    assert changed is True
    assert mean_luma < 72
    assert float(np.mean(enhanced)) > float(np.mean(dark))

    bright = np.full((96, 96, 3), 180, dtype=np.uint8)
    untouched, _, changed = PPEDetector.enhance_low_light(bright, threshold=72)
    assert changed is False
    assert untouched is bright


def test_class_aware_nms_keeps_helmet_and_vest_at_same_location():
    objects = [
        {"class": "helmet", "bbox": [10, 10, 40, 40], "confidence": 0.8},
        {"class": "helmet", "bbox": [11, 11, 41, 41], "confidence": 0.6},
        {"class": "safety-vest", "bbox": [10, 10, 40, 40], "confidence": 0.7},
    ]

    kept = non_max_suppression(objects, class_aware=True)

    assert len(kept) == 2
    assert {item["class"] for item in kept} == {"helmet", "safety-vest"}


def test_class_aware_association_assigns_head_and_torso_ppe():
    detector = PPEDetector.__new__(PPEDetector)
    persons = [{"bbox": [100, 100, 300, 600], "confidence": 0.9}]
    ppe = [
        {"class": "helmet", "bbox": [155, 70, 245, 180], "confidence": 0.75},
        {"class": "safety-vest", "bbox": [130, 220, 270, 420], "confidence": 0.82},
    ]

    result = detector._associate_ppe(persons, ppe, img_h=720, required=["helmet", "safety-vest"])

    assert len(result) == 1
    assert result[0]["is_compliant"] is True
    assert result[0]["wearing"] == ["helmet", "safety-vest"]
    assert result[0]["wearing_confidences"]["helmet"] == 0.75


def test_helmet_near_another_persons_torso_is_not_misassigned():
    detector = PPEDetector.__new__(PPEDetector)
    persons = [
        {"bbox": [0, 100, 100, 500], "confidence": 0.9},
        {"bbox": [120, 100, 220, 500], "confidence": 0.9},
    ]
    ppe = [{"class": "helmet", "bbox": [145, 70, 195, 140], "confidence": 0.8}]

    result = detector._associate_ppe(persons, ppe, img_h=600, required=["helmet"])

    assert result[0]["not_wearing"] == ["helmet"]
    assert result[1]["wearing"] == ["helmet"]
