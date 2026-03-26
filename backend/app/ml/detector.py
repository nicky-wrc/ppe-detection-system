"""
PPE Detection System - SH17 Pre-trained Model
ใช้โมเดล YOLOv8 ที่เทรนบน SH17 dataset ตรวจจับ PPE โดยตรง
ไม่ต้องเดาจากสีอีกต่อไป - โมเดลรู้จัก Helmet, Safety-vest, Person ฯลฯ
"""

import cv2
import numpy as np
import os
import time
from pathlib import Path
from typing import List, Dict, Any
from ultralytics import YOLO
from PIL import Image, ImageDraw, ImageFont


# SH17 class mapping (17 classes)
SH17_CLASSES = {
    0: "person", 1: "ear", 2: "ear-mufs", 3: "face", 4: "face-guard",
    5: "face-mask", 6: "foot", 7: "tool", 8: "glasses", 9: "gloves",
    10: "helmet", 11: "hands", 12: "head", 13: "medical-suit",
    14: "shoes", 15: "safety-suit", 16: "safety-vest",
}

SH17_THAI = {
    "person": "คน", "helmet": "หมวกนิรภัย", "safety-vest": "เสื้อสะท้อนแสง",
    "glasses": "แว่นตานิรภัย", "gloves": "ถุงมือ", "shoes": "รองเท้านิรภัย",
    "face-mask": "หน้ากาก", "face-guard": "กระบังหน้า", "ear-mufs": "ที่ครอบหู",
    "head": "ศีรษะ", "face": "ใบหน้า", "hands": "มือ", "foot": "เท้า",
    "ear": "หู", "tool": "เครื่องมือ", "medical-suit": "ชุดการแพทย์",
    "safety-suit": "ชุดนิรภัย",
}

PPE_ITEMS = {"helmet", "safety-vest"}
DEFAULT_REQUIRED_PPE = ["helmet", "safety-vest"]


class PPEDetector:

    CONF_THRESHOLD = 0.25
    PERSON_CONF = 0.40
    IOU_THRESHOLD = 0.45

    def __init__(self):
        self.ppe_model = None
        self.font = None
        self.font_small = None
        self._load_model()
        self._load_font()

    def _load_model(self):
        model_dir = Path(__file__).resolve().parent.parent.parent
        candidates = ["yolo8m.pt", "yolo8s.pt", "yolo8n.pt", "yolo11n.pt"]
        for name in candidates:
            p = model_dir / name
            if p.exists():
                try:
                    self.ppe_model = YOLO(str(p))
                    print(f"[PPE] SH17 model loaded: {name}")
                    return
                except Exception as e:
                    print(f"[PPE] Failed to load {name}: {e}")
        print("[PPE] ERROR: No SH17 model found! Place yolo8m.pt or yolo8s.pt in backend/")

    def _load_font(self):
        try:
            for fp in [
                "C:/Windows/Fonts/tahoma.ttf",
                "C:/Windows/Fonts/THSarabunNew.ttf",
                "C:/Windows/Fonts/cordia.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            ]:
                if Path(fp).exists():
                    self.font = ImageFont.truetype(fp, 24)
                    self.font_small = ImageFont.truetype(fp, 18)
                    return
            self.font = ImageFont.load_default()
            self.font_small = ImageFont.load_default()
        except Exception:
            self.font = ImageFont.load_default()
            self.font_small = ImageFont.load_default()

    # ------------------------------------------------------------------ #
    #  Core detection: SH17 model detects ALL classes in one pass
    # ------------------------------------------------------------------ #

    def detect(self, image: np.ndarray, required_ppe: List[str] | None = None) -> Dict[str, Any]:
        start = time.time()
        if self.ppe_model is None:
            return self._empty_result()

        required = required_ppe or DEFAULT_REQUIRED_PPE
        results = self.ppe_model(image, conf=self.CONF_THRESHOLD, iou=self.IOU_THRESHOLD, verbose=False)

        raw_persons = []
        ppe_objects = []

        for r in results:
            if r.boxes is None:
                continue
            for box in r.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                bbox = box.xyxy[0].tolist()
                cls_name = SH17_CLASSES.get(cls_id, f"class_{cls_id}")

                if cls_name == "person" and conf >= self.PERSON_CONF:
                    raw_persons.append({"bbox": bbox, "confidence": conf})
                elif cls_name in PPE_ITEMS:
                    ppe_objects.append({"class": cls_name, "bbox": bbox, "confidence": conf})

        persons = self._associate_ppe(raw_persons, ppe_objects, image.shape[0], required=required)

        violation_count = sum(1 for p in persons if not p["is_compliant"])
        violations = []
        for p in persons:
            for item in p["not_wearing"]:
                tag = f"ไม่สวม{SH17_THAI.get(item, item)}"
                if tag not in violations:
                    violations.append(tag)

        ms = (time.time() - start) * 1000
        n = len(persons)
        ok = n - violation_count

        if n == 0:
            status, msg = "no_person", "ไม่พบคนในภาพ"
        elif violation_count == 0:
            status, msg = "compliant", f"พบ {n} คน - สวม PPE ครบถ้วนทุกคน"
        else:
            status = "violation"
            msg = (
                "ตรวจพบ: " + " และ ".join(violations)
                if violations
                else f"พบ {n} คน - มี {violation_count} คนฝ่าฝืน"
            )

        return {
            "detected_objects": [
                {"class_id": 0, "class_name": "person", "class_name_thai": "คน",
                 "confidence": p["confidence"], "bbox": p["bbox"],
                 "is_violation": not p["is_compliant"], "is_person": True}
                for p in persons
            ],
            "persons": persons,
            "violations": violations,
            "person_count": n,
            "violation_count": violation_count,
            "has_violation": violation_count > 0,
            "processing_time_ms": round(ms, 2),
            "summary": {"message": msg, "status": status,
                        "total_persons": n, "compliant_persons": ok,
                        "non_compliant_persons": violation_count},
        }

    def _associate_ppe(self, raw_persons: list, ppe_objects: list, img_h: int, required: List[str]) -> list:
        """Associate each PPE item with the nearest/best-matching person."""
        persons = []
        for rp in raw_persons:
            px1, py1, px2, py2 = rp["bbox"]
            ph = py2 - py1
            pw = px2 - px1
            if img_h > 0 and ph / img_h < 0.06:
                continue
            persons.append({
                "bbox": rp["bbox"], "confidence": rp["confidence"],
                "found_ppe": set(),
            })

        if not persons:
            return []

        for ppe in ppe_objects:
            ppe_cls = ppe["class"]
            eb = ppe["bbox"]
            ppe_cx = (eb[0] + eb[2]) / 2
            ppe_cy = (eb[1] + eb[3]) / 2

            best_idx = -1
            best_score = 0

            for i, p in enumerate(persons):
                px1, py1, px2, py2 = p["bbox"]
                pw = px2 - px1
                ph = py2 - py1

                # Expand person bbox by 15% for helmet (top) and 10% for vest (sides)
                margin_x = pw * 0.10
                margin_top = ph * 0.15
                margin_bot = ph * 0.05
                ex1 = px1 - margin_x
                ey1 = py1 - margin_top
                ex2 = px2 + margin_x
                ey2 = py2 + margin_bot

                # Check if PPE center is inside expanded person bbox
                if not (ex1 <= ppe_cx <= ex2 and ey1 <= ppe_cy <= ey2):
                    continue

                # Score: prefer person whose center is closest to PPE center
                pcx = (px1 + px2) / 2
                pcy = (py1 + py2) / 2
                dist = ((ppe_cx - pcx) ** 2 + (ppe_cy - pcy) ** 2) ** 0.5
                max_dist = (pw ** 2 + ph ** 2) ** 0.5
                score = 1.0 - (dist / max_dist) if max_dist > 0 else 0
                if score > best_score:
                    best_score = score
                    best_idx = i

            if best_idx >= 0:
                persons[best_idx]["found_ppe"].add(ppe_cls)

        result = []
        for p in persons:
            wearing = []
            not_wearing = []
            for req in required:
                if req in p["found_ppe"]:
                    # return class keys (frontend can localize); keep Thai mapping via SH17_THAI when needed
                    wearing.append(req)
                else:
                    not_wearing.append(req)

            compliant = len(not_wearing) == 0
            result.append({
                "id": len(result) + 1,
                "bbox": p["bbox"],
                "confidence": p["confidence"],
                "wearing": wearing,
                "not_wearing": not_wearing,
                "is_compliant": compliant,
            })

        return result

    def _empty_result(self) -> Dict[str, Any]:
        return {
            "detected_objects": [], "persons": [], "violations": [],
            "person_count": 0, "violation_count": 0, "has_violation": False,
            "processing_time_ms": 0,
            "summary": {"message": "ไม่สามารถประมวลผลได้ - ไม่พบโมเดล", "status": "error"},
        }

    # ------------------------------------------------------------------ #
    #  Drawing
    # ------------------------------------------------------------------ #

    def draw_detections(self, image: np.ndarray, det: Dict[str, Any]) -> np.ndarray:
        rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        pil = Image.fromarray(rgb)
        draw = ImageDraw.Draw(pil)
        persons = det.get("persons", [])
        summary = det.get("summary", {})
        st = summary.get("status", "")

        GREEN = (34, 197, 94)
        RED = (239, 68, 68)
        DARK_GREEN = (22, 163, 74)
        DARK_RED = (200, 30, 30)
        WHITE = (255, 255, 255)
        GRAY = (100, 116, 139)

        bh = 50
        bc = DARK_GREEN if st == "compliant" else DARK_RED if st == "violation" else GRAY
        overlay = Image.new("RGBA", pil.size, (0, 0, 0, 0))
        ImageDraw.Draw(overlay).rectangle([(0, 0), (pil.width, bh)], fill=(*bc, 220))
        pil = Image.alpha_composite(pil.convert("RGBA"), overlay).convert("RGB")
        draw = ImageDraw.Draw(pil)

        txt = summary.get("message", "PPE Detection")
        self._draw_text(draw, (15, 10), txt, self.font, WHITE)

        ptxt = f"ตรวจพบ {len(persons)} คน"
        try:
            tb = draw.textbbox((0, 0), ptxt, font=self.font_small)
            self._draw_text(draw, (pil.width - (tb[2] - tb[0]) - 15, 14), ptxt, self.font_small, WHITE)
        except Exception:
            pass

        for p in persons:
            x1, y1, x2, y2 = map(int, p["bbox"])
            ok = p["is_compliant"]
            col = GREEN if ok else RED

            draw.rectangle([(x1, y1), (x2, y2)], outline=col, width=3)
            cl = min(25, (x2 - x1) // 4, (y2 - y1) // 4)
            for cx, cy, dx, dy in [(x1, y1, 1, 1), (x2, y1, -1, 1), (x1, y2, 1, -1), (x2, y2, -1, -1)]:
                draw.line([(cx, cy), (cx + cl * dx, cy)], fill=col, width=5)
                draw.line([(cx, cy), (cx, cy + cl * dy)], fill=col, width=5)

            conf_pct = int(p['confidence'] * 100)
            status_label = "ปลอดภัย" if ok else "ฝ่าฝืน"
            lbl = f"คนที่ {p['id']} ({conf_pct}%) - {status_label}"
            self._draw_label(draw, x1, y1 - 28, lbl, self.font_small, col)

            ly = y1 + 6
            for item in p.get("wearing", []):
                self._draw_label(draw, x1 + 5, ly, f"✓ {item}", self.font_small, DARK_GREEN)
                ly += 26

            for item in p.get("not_wearing", []):
                self._draw_label(draw, x1 + 5, ly, f"✗ {item}", self.font_small, DARK_RED)
                ly += 26

        return cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)

    def _draw_text(self, draw: ImageDraw.Draw, xy, text: str, font, fill):
        try:
            draw.text(xy, text, font=font, fill=fill)
        except Exception:
            draw.text(xy, text, fill=fill)

    def _draw_label(self, draw: ImageDraw.Draw, x: int, y: int, text: str, font, bg_color):
        try:
            tb = draw.textbbox((x, y), text, font=font)
            draw.rectangle([(tb[0] - 4, tb[1] - 2), (tb[2] + 4, tb[3] + 2)], fill=bg_color)
            draw.text((x, y), text, font=font, fill=(255, 255, 255))
        except Exception:
            draw.rectangle([(x, y), (x + 160, y + 22)], fill=bg_color)
            draw.text((x + 3, y + 2), text, fill=(255, 255, 255))

    # ------------------------------------------------------------------ #
    #  Image processing
    # ------------------------------------------------------------------ #

    def process_image(self, image_path: str, output_path: str, required_ppe: List[str] | None = None) -> Dict[str, Any]:
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"ไม่สามารถโหลดภาพ: {image_path}")
        det = self.detect(image, required_ppe=required_ppe)
        cv2.imwrite(output_path, self.draw_detections(image, det))
        return det

    # ------------------------------------------------------------------ #
    #  Video processing
    # ------------------------------------------------------------------ #

    def _analyze_frame_from_results(self, frame: np.ndarray, yolo_result, required: List[str]) -> Dict[str, Any]:
        """Build detection dict from SH17 model result."""
        start = time.time()
        raw_persons = []
        ppe_objects = []

        if yolo_result.boxes is not None:
            for box in yolo_result.boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                bbox = box.xyxy[0].tolist()
                cls_name = SH17_CLASSES.get(cls_id, f"class_{cls_id}")

                if cls_name == "person" and conf >= self.PERSON_CONF:
                    raw_persons.append({"bbox": bbox, "confidence": conf})
                elif cls_name in PPE_ITEMS:
                    ppe_objects.append({"class": cls_name, "bbox": bbox, "confidence": conf})

        persons = self._associate_ppe(raw_persons, ppe_objects, frame.shape[0], required=required)

        vc = sum(1 for p in persons if not p["is_compliant"])
        violations = []
        for p in persons:
            for item in p["not_wearing"]:
                tag = f"ไม่สวม{SH17_THAI.get(item, item)}"
                if tag not in violations:
                    violations.append(tag)

        n = len(persons)
        ok = n - vc
        ms = (time.time() - start) * 1000

        if n == 0:
            st, msg = "no_person", "ไม่พบคนในภาพ"
        elif vc == 0:
            st, msg = "compliant", f"พบ {n} คน - สวม PPE ครบถ้วนทุกคน"
        else:
            st = "violation"
            msg = (
                "ตรวจพบ: " + " และ ".join(violations)
                if violations
                else f"พบ {n} คน - มี {vc} คนฝ่าฝืน"
            )

        return {
            "persons": persons, "violations": violations,
            "person_count": n, "violation_count": vc,
            "has_violation": vc > 0,
            "processing_time_ms": round(ms, 2),
            "summary": {"message": msg, "status": st,
                        "total_persons": n, "compliant_persons": ok,
                        "non_compliant_persons": vc},
        }

    def process_video(self, video_path: str, output_path: str, required_ppe: List[str] | None = None) -> Dict[str, Any]:
        print(f"[VIDEO] Start: {video_path}  size={os.path.getsize(video_path) if os.path.exists(video_path) else 0}")

        start = time.time()
        required = required_ppe or DEFAULT_REQUIRED_PPE
        all_violations: set[str] = set()
        annotated: list[np.ndarray] = []
        fps = 24
        processed = 0
        MAX_FRAMES = 80
        best_frame_det: Dict[str, Any] | None = None
        best_frame_idx = -1
        best_person_count = 0

        try:
            results_gen = self.ppe_model.predict(
                source=video_path,
                stream=True,
                vid_stride=5,
                imgsz=640,
                conf=self.CONF_THRESHOLD,
                iou=self.IOU_THRESHOLD,
                verbose=False,
            )

            for r in results_gen:
                frame_bgr = r.orig_img
                if frame_bgr is None:
                    continue

                if processed == 0:
                    try:
                        cap_t = cv2.VideoCapture(video_path)
                        fv = cap_t.get(cv2.CAP_PROP_FPS)
                        if fv > 0:
                            fps = int(fv)
                        cap_t.release()
                    except Exception:
                        pass

                det = self._analyze_frame_from_results(frame_bgr, r, required=required)
                annotated.append(self.draw_detections(frame_bgr, det))
                processed += 1

                pc = det.get("person_count", 0)
                if pc > best_person_count:
                    best_person_count = pc
                    best_frame_det = det
                    best_frame_idx = processed - 1
                elif best_frame_det is None and pc > 0:
                    best_frame_det = det
                    best_frame_idx = processed - 1

                for v in det.get("violations", []):
                    all_violations.add(v)

                if processed % 10 == 0:
                    print(f"[VIDEO] {processed} frames done")

                if processed >= MAX_FRAMES:
                    print(f"[VIDEO] Hit frame limit ({MAX_FRAMES})")
                    break

            if best_frame_det is None and processed > 0:
                best_frame_det = det
                best_frame_idx = processed - 1
            print(f"[VIDEO] processed {processed} frames")

        except Exception as e:
            print(f"[VIDEO] stream error: {e}, trying OpenCV fallback...")
            cap = cv2.VideoCapture(video_path)
            if cap.isOpened():
                fv = cap.get(cv2.CAP_PROP_FPS)
                if fv > 0:
                    fps = int(fv)
                idx = 0
                while idx < MAX_FRAMES * 5:
                    ret, frame = cap.read()
                    if not ret:
                        break
                    idx += 1
                    if idx % 5 != 1:
                        continue
                    det = self.detect(frame, required_ppe=required)
                    annotated.append(self.draw_detections(frame, det))
                    processed += 1
                    pc = det.get("person_count", 0)
                    if pc > best_person_count:
                        best_person_count = pc
                        best_frame_det = det
                        best_frame_idx = processed - 1
                    elif best_frame_det is None and pc > 0:
                        best_frame_det = det
                        best_frame_idx = processed - 1
                    for v in det.get("violations", []):
                        all_violations.add(v)
                    if processed >= MAX_FRAMES:
                        break
                if best_frame_det is None and processed > 0:
                    best_frame_det = det
                    best_frame_idx = processed - 1
                cap.release()
                print(f"[VIDEO] OpenCV fallback: {processed} frames")

        if len(annotated) == 0:
            raise ValueError("ไม่สามารถอ่านเฟรมจากวิดีโอได้ กรุณาลองไฟล์อื่น")

        ms = (time.time() - start) * 1000

        base = output_path.rsplit(".", 1)[0]
        best_frame_path = base + "_best.jpg"
        if 0 <= best_frame_idx < len(annotated):
            cv2.imwrite(best_frame_path, annotated[best_frame_idx])
        else:
            cv2.imwrite(best_frame_path, annotated[len(annotated) // 2])
        print(f"[VIDEO] Saved best frame idx={best_frame_idx}: {best_frame_path}")

        self._write_video(annotated, output_path, fps)
        output_final = best_frame_path

        best_persons = best_frame_det.get("persons", []) if best_frame_det else []
        best_pc = len(best_persons)
        best_vc = sum(1 for p in best_persons if not p["is_compliant"])
        best_ok = best_pc - best_vc

        has_v = best_vc > 0
        if best_pc == 0:
            st, msg = "no_person", "ไม่พบคนในวิดีโอ"
        elif not has_v:
            st, msg = "compliant", f"พบ {best_pc} คน - สวม PPE ครบถ้วนทุกคน"
        else:
            st = "violation"
            viol_sorted = sorted(all_violations) if all_violations else []
            msg = (
                "ตรวจพบ: " + " และ ".join(viol_sorted)
                if viol_sorted
                else f"พบ {best_pc} คน - มี {best_vc} คนฝ่าฝืน"
            )

        print(f"[VIDEO] Done {ms:.0f}ms | persons={best_pc} | violations={best_vc}")

        best_objects = [
            {"class_id": 0, "class_name": "person", "class_name_thai": "คน",
             "confidence": p["confidence"], "bbox": p["bbox"],
             "is_violation": not p["is_compliant"], "is_person": True}
            for p in best_persons
        ]

        return {
            "detected_objects": best_objects,
            "persons": best_persons,
            "violations": list(all_violations),
            "person_count": best_pc,
            "violation_count": best_vc,
            "has_violation": has_v,
            "processing_time_ms": round(ms, 2),
            "output_video_path": output_final,
            "frames_processed": processed,
            "summary": {"message": msg, "status": st,
                        "total_persons": best_pc,
                        "compliant_persons": best_ok,
                        "non_compliant_persons": best_vc},
        }

    def _write_video(self, frames: list, output_path: str, fps: int) -> str:
        import subprocess
        h, w = frames[0].shape[:2]
        out_fps = min(fps, 15)
        base = output_path.rsplit(".", 1)[0]

        for codec, ext in [("mp4v", ".mp4"), ("XVID", ".avi")]:
            try_path = base + ext
            fourcc = cv2.VideoWriter_fourcc(*codec)
            writer = cv2.VideoWriter(try_path, fourcc, out_fps, (w, h))
            if writer.isOpened():
                for f in frames:
                    writer.write(f)
                writer.release()
                sz = os.path.getsize(try_path) if os.path.exists(try_path) else 0
                if sz > 1000:
                    if ext == ".avi":
                        mp4 = base + ".mp4"
                        try:
                            subprocess.run(
                                ["ffmpeg", "-y", "-i", try_path, "-c:v", "libx264",
                                 "-preset", "fast", "-crf", "23", mp4],
                                capture_output=True, timeout=120)
                            if os.path.exists(mp4) and os.path.getsize(mp4) > 1000:
                                os.remove(try_path)
                                return mp4
                        except Exception:
                            pass
                    return try_path
            writer.release()

        fallback = base + ".jpg"
        cv2.imwrite(fallback, frames[len(frames) // 2])
        return fallback


# ------------------------------------------------------------------ #
#  Singleton
# ------------------------------------------------------------------ #

_detector = None

def get_detector() -> PPEDetector:
    global _detector
    if _detector is None:
        _detector = PPEDetector()
    return _detector

def reset_detector():
    global _detector
    _detector = None
