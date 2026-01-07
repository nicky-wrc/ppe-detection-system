import cv2
import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Optional
from ultralytics import YOLO
import time
from app.core.config import settings


class PPEDetector:
    CLASS_NAMES = {
        0: "hardhat",
        1: "mask",
        2: "no_hardhat",
        3: "no_mask",
        4: "no_safety_vest",
        5: "person",
        6: "safety_cone",
        7: "safety_vest",
        8: "machinery",
        9: "vehicle"
    }
    
    VIOLATION_CLASSES = ["no_hardhat", "no_mask", "no_safety_vest"]
    
    COLORS = {
        "person": (255, 165, 0),
        "hardhat": (0, 255, 0),
        "no_hardhat": (0, 0, 255),
        "safety_vest": (0, 255, 0),
        "no_safety_vest": (0, 0, 255),
        "mask": (0, 255, 0),
        "no_mask": (0, 0, 255),
        "safety_cone": (255, 255, 0),
        "machinery": (128, 128, 128),
        "vehicle": (128, 128, 128)
    }

    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path or settings.MODEL_PATH
        self.model = None
        self.confidence_threshold = settings.CONFIDENCE_THRESHOLD
        self._load_model()

    def _load_model(self):
        try:
            if Path(self.model_path).exists():
                self.model = YOLO(self.model_path)
                print(f"Loaded model from {self.model_path}")
            else:
                print(f"Model not found at {self.model_path}, using YOLOv8n")
                self.model = YOLO("yolov8n.pt")
        except Exception as e:
            print(f"Error loading model: {e}")
            print("Running without model...")
            self.model = None

    def detect(self, image: np.ndarray) -> Dict[str, Any]:
        start_time = time.time()
        
        if self.model is None:
            return {
                "detected_objects": [],
                "violations": [],
                "person_count": 0,
                "violation_count": 0,
                "has_violation": False,
                "processing_time_ms": 0
            }
        
        results = self.model(
            image,
            conf=self.confidence_threshold,
            verbose=False
        )
        
        detected_objects = []
        violations = []
        person_count = 0
        violation_count = 0
        
        for result in results:
            boxes = result.boxes
            if boxes is not None:
                for box in boxes:
                    cls_id = int(box.cls[0])
                    confidence = float(box.conf[0])
                    bbox = box.xyxy[0].tolist()
                    
                    class_name = self.CLASS_NAMES.get(cls_id, f"class_{cls_id}")
                    is_violation = class_name in self.VIOLATION_CLASSES
                    
                    detected_objects.append({
                        "class_id": cls_id,
                        "class_name": class_name,
                        "confidence": round(confidence, 4),
                        "bbox": [round(x, 2) for x in bbox],
                        "is_violation": is_violation
                    })
                    
                    if class_name == "person":
                        person_count += 1
                    
                    if is_violation:
                        violation_count += 1
                        violations.append(class_name)
        
        processing_time = (time.time() - start_time) * 1000
        
        return {
            "detected_objects": detected_objects,
            "violations": list(set(violations)),
            "person_count": person_count,
            "violation_count": violation_count,
            "has_violation": violation_count > 0,
            "processing_time_ms": round(processing_time, 2)
        }

    def draw_detections(self, image: np.ndarray, detections: List[Dict]) -> np.ndarray:
        result_image = image.copy()
        
        for det in detections:
            bbox = det["bbox"]
            class_name = det["class_name"]
            confidence = det["confidence"]
            is_violation = det["is_violation"]
            
            x1, y1, x2, y2 = map(int, bbox)
            color = self.COLORS.get(class_name, (128, 128, 128))
            thickness = 3 if is_violation else 2
            
            cv2.rectangle(result_image, (x1, y1), (x2, y2), color, thickness)
            
            label = f"{class_name}: {confidence:.2f}"
            font_scale = 0.6
            (text_width, text_height), _ = cv2.getTextSize(
                label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, 2
            )
            
            cv2.rectangle(
                result_image,
                (x1, y1 - text_height - 10),
                (x1 + text_width + 10, y1),
                color,
                -1
            )
            
            cv2.putText(
                result_image,
                label,
                (x1 + 5, y1 - 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                font_scale,
                (255, 255, 255),
                2
            )
        
        return result_image

    def process_image(self, image_path: str, output_path: str) -> Dict[str, Any]:
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Could not load image: {image_path}")
        
        detection_result = self.detect(image)
        result_image = self.draw_detections(image, detection_result["detected_objects"])
        cv2.imwrite(output_path, result_image)
        
        return detection_result


detector = None

def get_detector() -> PPEDetector:
    global detector
    if detector is None:
        detector = PPEDetector()
    return detector