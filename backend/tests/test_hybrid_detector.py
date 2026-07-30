import numpy as np

from app.ml.detector import (
    PPEDetector,
    canonical_ppe_class,
    crop_refinement_confidence,
    fuse_person_detections,
    non_max_suppression,
    ppe_sensitivity_to_confidence,
)


def test_ppe_sensitivity_lowers_ppe_confidence_floor():
    assert ppe_sensitivity_to_confidence(20) == 0.38
    assert ppe_sensitivity_to_confidence(60) == 0.24
    assert ppe_sensitivity_to_confidence(100) == 0.1


def test_safety_suit_is_compatible_with_required_safety_vest():
    assert canonical_ppe_class("safety-suit") == "safety-vest"
    assert canonical_ppe_class("helmet") == "helmet"


def test_crop_refinement_uses_guarded_rescue_confidence():
    assert crop_refinement_confidence(0.24) == 0.144
    assert crop_refinement_confidence(0.10) == 0.10


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


def test_large_front_facing_helmet_matches_loose_person_box():
    detector = PPEDetector.__new__(PPEDetector)
    persons = [{"bbox": [126.0, 20.0, 526.0, 480.0], "confidence": 0.9}]
    ppe = [
        {
            "class": "helmet",
            "bbox": [173.0, 146.0, 438.0, 317.0],
            "confidence": 0.79,
        }
    ]

    result = detector._associate_ppe(persons, ppe, img_h=480, required=["helmet"])

    assert result[0]["wearing"] == ["helmet"]
    assert result[0]["is_compliant"] is True


def test_person_fusion_merges_nested_cross_model_boxes():
    persons = [
        {
            "bbox": [204.0, 334.0, 527.0, 480.0],
            "confidence": 0.35,
            "source": "yolov8-sh17",
        },
        {
            "bbox": [349.0, 367.0, 526.0, 474.0],
            "confidence": 0.46,
            "source": "yolo11-person",
        },
    ]

    fused = fuse_person_detections(persons, image_width=640, image_height=480)

    assert len(fused) == 1
    assert fused[0]["bbox"] == [204.0, 334.0, 527.0, 480.0]
    assert fused[0]["confidence"] == 0.46
    assert fused[0]["source"] == "yolo11-person+yolov8-sh17"


def test_person_fusion_filters_tiny_background_false_positive():
    persons = [
        {
            "bbox": [221.0, 134.0, 233.0, 165.0],
            "confidence": 0.84,
            "source": "yolov8-sh17",
        },
        {
            "bbox": [296.0, 272.0, 514.0, 480.0],
            "confidence": 0.78,
            "source": "yolo11-person",
        },
    ]

    fused = fuse_person_detections(persons, image_width=640, image_height=480)

    assert len(fused) == 1
    assert fused[0]["bbox"] == [296.0, 272.0, 514.0, 480.0]


def test_person_fusion_keeps_nearby_people_separate():
    persons = [
        {
            "bbox": [80.0, 80.0, 240.0, 460.0],
            "confidence": 0.88,
            "source": "yolo11-person",
        },
        {
            "bbox": [260.0, 90.0, 420.0, 470.0],
            "confidence": 0.82,
            "source": "yolov8-sh17",
        },
    ]

    fused = fuse_person_detections(persons, image_width=640, image_height=480)

    assert len(fused) == 2


def test_person_fusion_keeps_small_plausible_distant_person():
    persons = [
        {
            "bbox": [100.0, 100.0, 115.0, 140.0],
            "confidence": 0.62,
            "source": "yolo11-person",
        }
    ]

    fused = fuse_person_detections(persons, image_width=640, image_height=480)

    assert len(fused) == 1


def test_person_fusion_filters_partial_edge_sliver():
    persons = [
        {
            "bbox": [603.0, 241.0, 640.0, 469.0],
            "confidence": 0.43,
            "source": "yolov8-sh17",
        },
        {
            "bbox": [604.0, 321.0, 640.0, 436.0],
            "confidence": 0.31,
            "source": "yolo11-person",
        },
    ]

    fused = fuse_person_detections(persons, image_width=640, image_height=480)

    assert fused == []


def test_person_fusion_filters_small_unconfirmed_sh17_background_box():
    persons = [
        {
            "bbox": [188.0, 279.0, 213.0, 346.0],
            "confidence": 0.63,
            "source": "yolov8-sh17",
        }
    ]

    fused = fuse_person_detections(persons, image_width=640, image_height=480)

    assert fused == []


def test_person_fusion_keeps_large_unconfirmed_sh17_person():
    persons = [
        {
            "bbox": [160.0, 80.0, 360.0, 470.0],
            "confidence": 0.81,
            "source": "yolov8-sh17",
        }
    ]

    fused = fuse_person_detections(persons, image_width=640, image_height=480)

    assert len(fused) == 1
