"""
PPE Detection System - ตรวจจับหมวกนิรภัยและเสื้อสะท้อนแสง
"""

import cv2
import numpy as np
from pathlib import Path
from typing import List, Dict, Any
from ultralytics import YOLO
import time
from PIL import Image, ImageDraw, ImageFont


class PPEDetector:
    """ระบบตรวจจับ PPE"""
    
    def __init__(self):
        self.model = None
        self.font = None
        self._load_model()
        self._load_font()

    def _load_model(self):
        """โหลด YOLO model สำหรับตรวจจับคน"""
        try:
            self.model = YOLO("yolov8n.pt")
            print("✅ โหลด model สำเร็จ")
        except Exception as e:
            print(f"❌ ไม่สามารถโหลด model: {e}")
            self.model = None

    def _load_font(self):
        """โหลดฟอนต์ภาษาไทย"""
        try:
            font_paths = [
                "C:/Windows/Fonts/tahoma.ttf",
                "C:/Windows/Fonts/THSarabunNew.ttf",
                "C:/Windows/Fonts/cordia.ttf",
            ]
            
            for fp in font_paths:
                if Path(fp).exists():
                    self.font = ImageFont.truetype(fp, 24)
                    self.font_small = ImageFont.truetype(fp, 18)
                    print(f"✅ โหลดฟอนต์: {fp}")
                    return
            
            self.font = ImageFont.load_default()
            self.font_small = ImageFont.load_default()
        except:
            self.font = ImageFont.load_default()
            self.font_small = ImageFont.load_default()

    def detect_ppe(self, image: np.ndarray, person_bbox: List[float]) -> Dict[str, Any]:
        """ตรวจจับ PPE จาก bounding box ของคน (Enhanced with Morphological ops & Contours)"""
        x1, y1, x2, y2 = map(int, person_bbox)
        height = y2 - y1
        width = x2 - x1
        
        if height <= 0 or width <= 0:
            return {"hardhat": False, "vest": False}
        
        # === ตรวจสอบหมวกนิรภัย (ส่วนบน 25% + เผื่อขอบบนเล็กน้อย) ===
        head_y1 = max(0, y1 - int(height * 0.05))
        head_y2 = min(image.shape[0], y1 + int(height * 0.25))
        head_x1 = max(0, x1 + int(width * 0.15))
        head_x2 = min(image.shape[1], x2 - int(width * 0.15))
        
        has_hardhat = False
        if head_y2 > head_y1 and head_x2 > head_x1:
            head_region = image[head_y1:head_y2, head_x1:head_x2]
            if head_region.size > 0:
                hsv = cv2.cvtColor(head_region, cv2.COLOR_BGR2HSV)
                
                # สีหมวกนิรภัยที่พบบ่อย พร้อมปรับช่วงให้ครอบคลุมสภาพแสง
                yellow = cv2.inRange(hsv, np.array([12, 70, 70]), np.array([35, 255, 255]))
                orange = cv2.inRange(hsv, np.array([5, 100, 100]), np.array([20, 255, 255]))
                white = cv2.inRange(hsv, np.array([0, 0, 190]), np.array([180, 40, 255]))
                blue = cv2.inRange(hsv, np.array([90, 80, 80]), np.array([130, 255, 255]))
                
                helmet_mask = yellow | orange | white | blue
                
                # ลบนอยส์ออกและรวมรูปร่าง (Morphological operations)
                kernel = np.ones((3, 3), np.uint8)
                helmet_mask = cv2.morphologyEx(helmet_mask, cv2.MORPH_OPEN, kernel)
                helmet_mask = cv2.dilate(helmet_mask, kernel, iterations=1)
                
                # หา Contours (รูปร่าง)
                contours, _ = cv2.findContours(helmet_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                
                # ต้องใหญ่พอที่จะเป็นหมวก (ประมาณ 5% ของพื้นที่การค้นหาหัว)
                min_area = (head_x2 - head_x1) * (head_y2 - head_y1) * 0.05
                for cnt in contours:
                    if cv2.contourArea(cnt) > min_area:
                        has_hardhat = True
                        break
        
        # === ตรวจสอบเสื้อสะท้อนแสง (ส่วนกลาง 20-75%) ===
        body_y1 = min(image.shape[0], y1 + int(height * 0.20))
        body_y2 = min(image.shape[0], y1 + int(height * 0.75))
        
        has_vest = False
        if body_y2 > body_y1:
            body_region = image[body_y1:body_y2, head_x1:head_x2]
            if body_region.size > 0:
                hsv = cv2.cvtColor(body_region, cv2.COLOR_BGR2HSV)
                
                # สีเสื้อสะท้อนแสง (ส่วนใหญ่เป็นเหลือง-เขียวสะท้อนแสง หรือส้ม)
                neon_yellow = cv2.inRange(hsv, np.array([20, 80, 80]), np.array([45, 255, 255]))
                neon_orange = cv2.inRange(hsv, np.array([5, 100, 100]), np.array([25, 255, 255]))
                
                vest_mask = neon_yellow | neon_orange
                
                # ลบนอยส์ (Morphological operations) ใหญ่กว่าหมวกเพราะเสื้อชิ้นใหญ่กว่า
                kernel = np.ones((5, 5), np.uint8)
                vest_mask = cv2.morphologyEx(vest_mask, cv2.MORPH_OPEN, kernel)
                vest_mask = cv2.dilate(vest_mask, kernel, iterations=2)
                
                contours, _ = cv2.findContours(vest_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                
                # ต้องใหญ่พอ (ประมาณ 8% ของพื้นที่ลำตัวส่วนหน้า)
                min_vest_area = (head_x2 - head_x1) * (body_y2 - body_y1) * 0.08
                for cnt in contours:
                    if cv2.contourArea(cnt) > min_vest_area:
                        has_vest = True
                        break
        
        return {
            "hardhat": has_hardhat,
            "vest": has_vest
        }

    def detect(self, image: np.ndarray) -> Dict[str, Any]:
        """ตรวจจับ PPE ในภาพ"""
        start_time = time.time()
        
        if self.model is None:
            return self._empty_result()
        
        # ตรวจจับคน
        results = self.model(image, conf=0.5, verbose=False)
        
        persons = []
        violations = []
        violation_count = 0
        
        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue
            
            for box in boxes:
                cls_id = int(box.cls[0])
                confidence = float(box.conf[0])
                bbox = box.xyxy[0].tolist()
                
                # เฉพาะ class person (id = 0)
                if cls_id == 0:
                    # ตรวจจับ PPE
                    ppe_status = self.detect_ppe(image, bbox)
                    
                    wearing = []
                    not_wearing = []
                    
                    if ppe_status["hardhat"]:
                        wearing.append("หมวกนิรภัย")
                    else:
                        not_wearing.append("หมวกนิรภัย")
                    
                    if ppe_status["vest"]:
                        wearing.append("เสื้อสะท้อนแสง")
                    else:
                        not_wearing.append("เสื้อสะท้อนแสง")
                    
                    is_compliant = len(not_wearing) == 0
                    
                    if not is_compliant:
                        violation_count += 1
                        for item in not_wearing:
                            if f"ไม่สวม{item}" not in violations:
                                violations.append(f"ไม่สวม{item}")
                    
                    persons.append({
                        "id": len(persons) + 1,
                        "bbox": bbox,
                        "confidence": confidence,
                        "wearing": wearing,
                        "not_wearing": not_wearing,
                        "is_compliant": is_compliant
                    })
        
        processing_time = (time.time() - start_time) * 1000
        
        # สร้าง summary
        person_count = len(persons)
        compliant_count = sum(1 for p in persons if p["is_compliant"])
        
        if person_count == 0:
            status = "no_person"
            message = "ไม่พบคนในภาพ"
        elif violation_count == 0:
            status = "compliant"
            message = f"พบ {person_count} คน - ปฏิบัติตามกฎทุกคน"
        else:
            status = "violation"
            message = f"พบ {person_count} คน - มี {violation_count} คนฝ่าฝืน"
        
        # สร้าง detected_objects
        detected_objects = []
        for person in persons:
            detected_objects.append({
                "class_id": 0,
                "class_name": "person",
                "class_name_thai": "คน",
                "confidence": person["confidence"],
                "bbox": person["bbox"],
                "is_violation": not person["is_compliant"],
                "is_person": True
            })
        
        return {
            "detected_objects": detected_objects,
            "persons": persons,
            "violations": violations,
            "person_count": person_count,
            "violation_count": violation_count,
            "has_violation": violation_count > 0,
            "processing_time_ms": round(processing_time, 2),
            "summary": {
                "message": message,
                "status": status,
                "total_persons": person_count,
                "compliant_persons": compliant_count,
                "non_compliant_persons": violation_count
            }
        }

    def _empty_result(self) -> Dict[str, Any]:
        """ผลลัพธ์ว่าง"""
        return {
            "detected_objects": [],
            "persons": [],
            "violations": [],
            "person_count": 0,
            "violation_count": 0,
            "has_violation": False,
            "processing_time_ms": 0,
            "summary": {"message": "ไม่สามารถประมวลผลได้", "status": "error"}
        }

    def draw_detections(self, image: np.ndarray, detection_result: Dict[str, Any]) -> np.ndarray:
        """วาดผลการตรวจจับบนภาพ"""
        # แปลง BGR เป็น RGB สำหรับ PIL
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        pil_image = Image.fromarray(image_rgb)
        draw = ImageDraw.Draw(pil_image)
        
        persons = detection_result.get("persons", [])
        summary = detection_result.get("summary", {})
        status = summary.get("status", "")
        
        # วาด banner ที่ด้านบน
        banner_height = 50
        if status == "compliant":
            banner_color = (34, 139, 34)  # เขียว
        elif status == "violation":
            banner_color = (220, 20, 60)  # แดง
        else:
            banner_color = (128, 128, 128)  # เทา
        
        draw.rectangle([(0, 0), (pil_image.width, banner_height)], fill=banner_color)
        
        # ข้อความ banner
        banner_text = summary.get("message", "PPE Detection")
        try:
            draw.text((15, 10), banner_text, font=self.font, fill=(255, 255, 255))
        except:
            draw.text((15, 10), banner_text, fill=(255, 255, 255))
        
        # วาดแต่ละคน
        for person in persons:
            bbox = person["bbox"]
            x1, y1, x2, y2 = map(int, bbox)
            is_compliant = person["is_compliant"]
            wearing = person.get("wearing", [])
            not_wearing = person.get("not_wearing", [])
            
            # สีกรอบ
            if is_compliant:
                box_color = (0, 200, 0)  # เขียว
            else:
                box_color = (255, 50, 50)  # แดง
            
            # วาดกรอบ
            draw.rectangle([(x1, y1), (x2, y2)], outline=box_color, width=3)
            
            # วาด label
            label_y = max(banner_height + 5, y1 - 30)
            
            if is_compliant:
                status_text = f"คน #{person['id']} ✓ ปลอดภัย"
                label_bg = (34, 139, 34)
            else:
                status_text = f"คน #{person['id']} ✗ ไม่ปลอดภัย"
                label_bg = (220, 20, 60)
            
            try:
                text_bbox = draw.textbbox((x1, label_y), status_text, font=self.font_small)
                padding = 5
                draw.rectangle([
                    (text_bbox[0] - padding, text_bbox[1] - padding),
                    (text_bbox[2] + padding, text_bbox[3] + padding)
                ], fill=label_bg)
                draw.text((x1, label_y), status_text, font=self.font_small, fill=(255, 255, 255))
            except:
                draw.text((x1, label_y), status_text, fill=(255, 255, 255))
            
            # แสดงสถานะ PPE
            info_y = y2 + 5
            
            if wearing:
                wearing_text = "สวม: " + ", ".join(wearing)
                try:
                    draw.text((x1, info_y), wearing_text, font=self.font_small, fill=(0, 180, 0))
                except:
                    draw.text((x1, info_y), wearing_text, fill=(0, 180, 0))
                info_y += 25
            
            if not_wearing and not is_compliant:
                not_wearing_text = "ไม่สวม: " + ", ".join(not_wearing)
                try:
                    draw.text((x1, info_y), not_wearing_text, font=self.font_small, fill=(255, 50, 50))
                except:
                    draw.text((x1, info_y), not_wearing_text, fill=(255, 50, 50))
        
        # แปลงกลับเป็น BGR
        result_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
        return result_image

    def process_image(self, image_path: str, output_path: str) -> Dict[str, Any]:
        """ประมวลผลภาพ"""
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"ไม่สามารถโหลดภาพ: {image_path}")
        
        detection_result = self.detect(image)
        result_image = self.draw_detections(image, detection_result)
        cv2.imwrite(output_path, result_image)
        
        return detection_result

    def process_video(self, video_path: str, output_path: str) -> Dict[str, Any]:
        """ประมวลผลวิดีโอ (อ่านทีละเฟรม ตรวจจับ และรวมเป็นวิดีโอใหม่)"""
        import os
        import subprocess
        import tempfile
        import glob
        
        print(f"[VIDEO] Starting video processing: {video_path}")
        print(f"[VIDEO] File exists: {os.path.exists(video_path)}, size: {os.path.getsize(video_path) if os.path.exists(video_path) else 'N/A'} bytes")
        
        frames = []
        fps = 30
        
        # === Strategy 1: Try OpenCV VideoCapture ===
        cap = cv2.VideoCapture(video_path)
        if cap.isOpened():
            fps_val = int(cap.get(cv2.CAP_PROP_FPS))
            if fps_val > 0:
                fps = fps_val
            total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            print(f"[VIDEO] OpenCV opened: {w}x{h}, FPS={fps}, Frames={total}")
            
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                frames.append(frame)
            cap.release()
            print(f"[VIDEO] OpenCV read {len(frames)} frames")
        else:
            print(f"[VIDEO] OpenCV cannot open video")
        
        # === Strategy 2: If 0 frames, try ffmpeg subprocess ===
        if len(frames) == 0:
            print(f"[VIDEO] Trying ffmpeg subprocess extraction...")
            tmp_dir = tempfile.mkdtemp(prefix="ppe_video_")
            try:
                # Extract frames using ffmpeg
                ffmpeg_cmd = [
                    "ffmpeg", "-i", video_path,
                    "-vf", "fps=5",  # Extract 5 fps to reduce processing
                    "-q:v", "2",
                    os.path.join(tmp_dir, "frame_%05d.jpg")
                ]
                result = subprocess.run(
                    ffmpeg_cmd, capture_output=True, text=True, timeout=120
                )
                print(f"[VIDEO] ffmpeg exit code: {result.returncode}")
                if result.returncode != 0:
                    print(f"[VIDEO] ffmpeg stderr: {result.stderr[:500]}")
                
                # Read extracted frames
                frame_files = sorted(glob.glob(os.path.join(tmp_dir, "frame_*.jpg")))
                print(f"[VIDEO] ffmpeg extracted {len(frame_files)} frames")
                fps = 5  # We extracted at 5 fps
                for ff in frame_files:
                    img = cv2.imread(ff)
                    if img is not None:
                        frames.append(img)
                    os.remove(ff)
            except FileNotFoundError:
                print(f"[VIDEO] ffmpeg not found in PATH")
            except subprocess.TimeoutExpired:
                print(f"[VIDEO] ffmpeg timed out")
            except Exception as e:
                print(f"[VIDEO] ffmpeg error: {e}")
            finally:
                try:
                    os.rmdir(tmp_dir)
                except:
                    pass
        
        # === Strategy 3: If still 0 frames, try imageio ===
        if len(frames) == 0:
            try:
                import imageio.v3 as iio
                print(f"[VIDEO] Trying imageio...")
                video_frames = iio.imread(video_path, plugin="pyav")
                for f in video_frames:
                    # imageio returns RGB, OpenCV uses BGR
                    frames.append(cv2.cvtColor(f, cv2.COLOR_RGB2BGR))
                print(f"[VIDEO] imageio read {len(frames)} frames")
            except ImportError:
                print(f"[VIDEO] imageio not available")
            except Exception as e:
                print(f"[VIDEO] imageio error: {e}")
        
        print(f"[VIDEO] Total frames collected: {len(frames)}")
        
        if len(frames) == 0:
            raise ValueError(f"ไม่สามารถอ่านเฟรมจากวิดีโอได้ กรุณาลองใช้ไฟล์วิดีโออื่น")
        
        # === Process each frame with YOLO detection ===
        start_time = time.time()
        all_violations = set()
        max_person_count = 0
        total_violation_frames = 0
        annotated_frames = []
        
        # Sample frames if too many (max ~300 frames to process)
        step = max(1, len(frames) // 300)
        sampled_frames = frames[::step]
        print(f"[VIDEO] Processing {len(sampled_frames)} frames (step={step})")
        
        for i, frame in enumerate(sampled_frames):
            detection_result = self.detect(frame)
            result_frame = self.draw_detections(frame, detection_result)
            annotated_frames.append(result_frame)
            
            p_count = detection_result.get("person_count", 0)
            if p_count > max_person_count:
                max_person_count = p_count
            
            v_count = detection_result.get("violation_count", 0)
            if v_count > 0:
                total_violation_frames += 1
                for v in detection_result.get("violations", []):
                    all_violations.add(v)
            
            if (i + 1) % 10 == 0:
                print(f"[VIDEO] Processed {i+1}/{len(sampled_frames)} frames, persons: {max_person_count}")
        
        processing_time = (time.time() - start_time) * 1000
        
        # === Write output video using XVID (most compatible on Windows) ===
        output_path_avi = output_path.rsplit('.', 1)[0] + '.avi'
        if len(annotated_frames) > 0:
            h, w = annotated_frames[0].shape[:2]
            out_fps = min(fps, 15)  # Cap at 15 fps for processed output
            fourcc = cv2.VideoWriter_fourcc(*'XVID')
            out = cv2.VideoWriter(output_path_avi, fourcc, out_fps, (w, h))
            
            if out.isOpened():
                for af in annotated_frames:
                    out.write(af)
                out.release()
                print(f"[VIDEO] Written {len(annotated_frames)} frames to {output_path_avi}")
            else:
                # Fallback: save as a single annotated image
                output_path_avi = output_path.rsplit('.', 1)[0] + '.jpg'
                # Use the frame with most detections (middle frame usually)
                mid = len(annotated_frames) // 2
                cv2.imwrite(output_path_avi, annotated_frames[mid])
                print(f"[VIDEO] Saved single frame image as fallback: {output_path_avi}")
        
        has_violation = total_violation_frames > 0
        
        print(f"[VIDEO] Done! Frames: {len(sampled_frames)}, Persons: {max_person_count}, Violations: {total_violation_frames}")
        
        if max_person_count == 0:
            status = "no_person"
            message = "ไม่พบคนในวิดีโอ"
        elif not has_violation:
            status = "compliant"
            message = f"พบคนสูงสุด {max_person_count} คน - ปฏิบัติตามกฎทุกคน"
        else:
            status = "violation"
            message = f"พบการฝ่าฝืนในวิดีโอ (ตรวจสอบพบ {total_violation_frames} เฟรม)"
        
        return {
            "detected_objects": [],
            "persons": [],
            "violations": list(all_violations),
            "person_count": max_person_count,
            "violation_count": 1 if has_violation else 0,
            "has_violation": has_violation,
            "processing_time_ms": round(processing_time, 2),
            "output_video_path": output_path_avi,
            "frames_processed": len(sampled_frames),
            "summary": {
                "message": message,
                "status": status,
                "total_persons": max_person_count,
                "compliant_persons": max_person_count if not has_violation else 0,
                "non_compliant_persons": 1 if has_violation else 0
            }
        }


# Singleton
_detector = None

def get_detector() -> PPEDetector:
    global _detector
    if _detector is None:
        _detector = PPEDetector()
    return _detector

def reset_detector():
    global _detector
    _detector = None
