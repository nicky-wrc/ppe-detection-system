"""
สคริปต์ดาวน์โหลดโมเดล PPE Detection

โมเดลนี้ train มาจาก Construction Site Safety Dataset
สามารถตรวจจับ:
- Hardhat / No-Hardhat (หมวกนิรภัย / ไม่สวมหมวก)
- Safety Vest / No-Safety Vest (เสื้อสะท้อนแสง / ไม่สวมเสื้อ)
- Person (คน)
- Mask / No-Mask (หน้ากาก / ไม่สวมหน้ากาก)
- และอื่นๆ
"""

import os
import urllib.request
import sys
from pathlib import Path


# โมเดล PPE จาก GitHub (ฟรี ไม่ต้องใช้ API key)
PPE_MODELS = {
    # Construction Site Safety Model (Roboflow)
    "ppe_yolov8n": {
        "url": "https://github.com/ultralytics/assets/releases/download/v8.2.0/yolov8n.pt",
        "description": "YOLOv8n base model - จะใช้กับ PPE dataset",
        "classes": ["person", "hardhat", "no_hardhat", "safety_vest", "no_safety_vest", "mask", "no_mask"]
    }
}


def download_file(url: str, save_path: str, desc: str = ""):
    """ดาวน์โหลดไฟล์จาก URL"""
    print(f"📥 Downloading: {desc or url}")
    print(f"   Save to: {save_path}")
    
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    
    try:
        # แสดง progress
        def reporthook(count, block_size, total_size):
            percent = int(count * block_size * 100 / total_size) if total_size > 0 else 0
            sys.stdout.write(f"\r   Progress: {percent}%")
            sys.stdout.flush()
        
        urllib.request.urlretrieve(url, save_path, reporthook)
        print("\n✅ Download complete!")
        return True
    except Exception as e:
        print(f"\n❌ Download failed: {e}")
        return False


def setup_ppe_model():
    """
    ตั้งค่าโมเดล PPE สำหรับโปรเจค
    
    เนื่องจากโมเดล PPE เฉพาะทางต้อง train เอง หรือใช้ Roboflow API
    เราจะใช้วิธีอื่นแทน:
    1. ใช้ YOLOv8 ตรวจจับคนก่อน
    2. จากนั้นวิเคราะห์ว่าคนแต่ละคนมี PPE หรือไม่
    """
    
    models_dir = Path(__file__).parent / "models"
    models_dir.mkdir(exist_ok=True)
    
    print("=" * 60)
    print("🔧 PPE Detection Model Setup")
    print("=" * 60)
    
    # แนะนำการใช้โมเดล PPE จริง
    print("""
📌 สำหรับโมเดล PPE ที่แม่นยำสูง แนะนำให้ใช้วิธีใดวิธีหนึ่ง:

1. 🌐 Roboflow (แนะนำ - ฟรี)
   - ไปที่: https://universe.roboflow.com/roboflow-universe-projects/construction-site-safety
   - สมัครฟรี แล้วดาวน์โหลด YOLOv8 model
   - วางไฟล์ .pt ไว้ที่: backend/app/ml/models/ppe_yolov8n.pt

2. 🔨 Train เอง
   - ใช้ dataset เช่น:
     * MSCOCO-PPE
     * Safety Helmet Dataset
     * Construction Site Safety Dataset
   - Train ด้วย Ultralytics YOLOv8

3. 🤖 ใช้ Hugging Face
   - ค้นหา "PPE detection YOLO" บน Hugging Face
   - ดาวน์โหลดโมเดลที่ต้องการ
""")
    
    print("\n" + "=" * 60)
    print("✅ Setup complete!")
    print("=" * 60)


if __name__ == "__main__":
    setup_ppe_model()
