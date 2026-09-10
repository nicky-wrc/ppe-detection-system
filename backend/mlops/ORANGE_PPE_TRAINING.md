# การฝึกเพิ่มสำหรับหมวกและเสื้อสะท้อนแสงสีส้ม

งานนี้สร้าง checkpoint ทดลองแยกจาก `backend/yolo8m.pt` และไม่เปลี่ยน `.env`
ชื่อรอบ: `orange-ppe-yolo8m-20260909-v2` — ฝึกครบ 20 epochs และประเมินเสร็จแล้ว
ดู [ผลเปรียบเทียบและข้อจำกัด](ORANGE_PPE_RESULTS_20260909.md) ก่อนนำ checkpoint ไปทดลอง

## ชุดข้อมูลและข้อจำกัด

แหล่งข้อมูล: [HardHat-Vest v3](https://www.kaggle.com/datasets/muhammetzahitaydn/hardhat-vest-dataset-v3)
ผู้เผยแพร่ระบุ CC0 บนหน้าดาวน์โหลด; archive ไม่มี LICENSE ภายในและรวบรวมหลายแหล่ง
โมเดลตั้งต้นเป็น SH17 research baseline จึงไม่ได้เปลี่ยนสถานะการอนุมัติ commercial model

- ZIP: `backend/datasets/hardhat-vest-dataset-v3.zip`
- SHA-256: `61048c7f9a52c8672e1989e338e61781515056ae3809c2fa7a40477ddf20afaf`
- ต้นฉบับ: 22,141 ภาพ; helmet 57,240, vest 8,131, head 124,341 instances
- มีชื่อคลาส person แต่ไม่มี person labels จึงวัดความแม่นยำตรวจคนจากชุดนี้ไม่ได้
- พบภาพซ้ำข้าม split 36 กลุ่ม; 35 กลุ่มมี label ขัดกัน
- ตัวเตรียมข้อมูลกันทุกสำเนาของกลุ่มที่ label ขัดกันออกจาก output และเก็บหนึ่งสำเนาของกลุ่มที่ label ตรงกัน
- คง source เดิมทั้งหมด; output เหลือ 22,070 ภาพ: train 17,214 / val 2,415 / test 2,441
- การคัดนี้ตรวจเฉพาะภาพซ้ำตรงกัน; ภาพที่ใกล้เคียงหรือมาจากฉากเดียวกันอาจยังข้าม split
- `vest` ใน dataset ครอบคลุมเสื้อคลุมและชุดหมีสะท้อนแสงด้วย ไม่ใช่เฉพาะเสื้อกั๊ก
- สีไม่ได้เป็น annotation: การตรวจสี HSV เป็นเพียงตัวช่วยสำรวจ ไม่ใช่ ground truth สำหรับรายงาน orange recall

## การเตรียมข้อมูล

รันคำสั่งจาก `backend/` ด้วย `.venv` ที่มี CUDA:

```powershell
.\.venv\Scripts\python.exe scripts/prepare_hardhat_vest.py --source datasets/hardhat-vest-v3-source --output datasets/hardhat-vest-v3-canonical --sh17-output datasets/hardhat-vest-v3-sh17 --source-url https://www.kaggle.com/datasets/muhammetzahitaydn/hardhat-vest-dataset-v3 --license "CC0 listed by publisher; source licenses require separate review" --source-archive datasets/hardhat-vest-dataset-v3.zip
.\.venv\Scripts\python.exe scripts/select_ppe_training.py --data datasets/hardhat-vest-v3-sh17/data.yaml
```

ใช้ SH17 schema 17 คลาสเพื่อรักษารหัสและเริ่มจากน้ำหนักหัวตรวจจับเดิม:
source helmet 0 -> 10, vest 1 -> 16, head 2 -> 12, person 3 -> 0
canonical view มีให้สำหรับงานที่ใช้ 3 คลาส แต่ห้ามประเมิน checkpoint 17 คลาสกับ canonical YAML โดยตรง
การคงชื่อคลาสไม่ได้รับประกันความสามารถเดิม: คลาสที่ไม่มี label เช่น person
อาจสูญเสียความสามารถระหว่าง fine-tune จึงห้ามแทนโมเดลของระบบโดยไม่มี regression test

ชุดฝึกที่เลือกประกอบด้วยภาพที่มี vest 3,088 ภาพ, helmet-only 3,088 ภาพ
และภาพอื่น 500 ภาพ รวม 6,676 ภาพ ใช้ seed 42; val/test ไม่ถูกนำเข้า train
ไฟล์ `focused-selection.json` บันทึกจำนวนและ hash ของรายชื่อภาพ

## การรันและดูสถานะ

```powershell
.\.venv\Scripts\python.exe scripts/run_orange_experiment.py --name orange-ppe-yolo8m-20260909-v2 --epochs 20
```

คำสั่งปฏิเสธชื่อรอบที่มีผลลัพธ์อยู่แล้ว ต้องใช้ชื่อใหม่หากเริ่มการทดลองใหม่
รอบนี้ใช้ YOLOv8m, imgsz 640, batch 16, workers 0, freeze 10,
AdamW lr 0.0003, hsv_h 0.025, early stopping patience 8
`workers=0` ลดการใช้ RAM จากการเปิด Python หลาย process บน Windows

Pipeline ทำ baseline validation, training, baseline test และ candidate test ตามลำดับ
ผลและ log อยู่ใน `backend/experiments/` ซึ่ง Git ignore:

- `orange-ppe-yolo8m-20260909-v2-job/status.json`: ขั้นตอนและสถานะจริง
- `orange-ppe-yolo8m-20260909-v2-job/training.log`: log การฝึก
- `orange-ppe-yolo8m-20260909-v2/results.csv`: metrics แต่ละ epoch
- `orange-ppe-yolo8m-20260909-v2/weights/best.pt`: checkpoint ที่เลือกจาก validation
- `orange-ppe-yolo8m-20260909-v2/weights/last.pt`: checkpoint ล่าสุด
- `orange-ppe-yolo8m-20260909-v2-job/comparison.json`: ผลเปรียบเทียบบน test หลัง pipeline เสร็จ

```powershell
Get-Content experiments/orange-ppe-yolo8m-20260909-v2-job/status.json
Get-Content experiments/orange-ppe-yolo8m-20260909-v2-job/training.log -Tail 5
```

หากโปรเซสหยุดกลางทางหลังมี `last.pt` แล้ว ให้ยืนยันว่าไม่มี job เดิมรันอยู่
แล้วต่อทั้ง pipeline ด้วยคำสั่งนี้ (ห้ามเปิด job ชื่อเดียวกันพร้อมกัน):

```powershell
.\.venv\Scripts\python.exe scripts/run_orange_experiment.py --name orange-ppe-yolo8m-20260909-v2 --epochs 20 --resume-job
```

คำสั่งเก็บ log เดิมไว้ สร้าง `training_resume_1.log` เป็นต้น และข้ามขั้นตอนที่เสร็จแล้ว
รอบนี้โปรเซสหยุดระหว่าง validation ของ epoch 11 โดยไม่มี Python traceback;
จึง resume จาก checkpoint ครบ epoch 10 เวลา 2026-09-09 18:48:59 Asia/Bangkok
สถานะ `running` ใน JSON เป็นสถานะล่าสุดที่เขียนไว้ ไม่ใช่หลักฐานว่าโปรเซสยังมีชีวิตอยู่
ตรวจ timestamp log และโปรเซสร่วมกันเสมอ; สาเหตุการหยุดครั้งนี้ยังไม่ยืนยัน

หากต้องการต่อเฉพาะ training โดยไม่ใช้ pipeline:

```powershell
.\.venv\Scripts\python.exe -m app.ml.train_ppe --data datasets/hardhat-vest-v3-sh17/data-focused.yaml --model experiments/orange-ppe-yolo8m-20260909-v2/weights/last.pt --name orange-ppe-yolo8m-20260909-v2 --resume --workers 0
```

การ resume ข้างต้นทำเฉพาะ training ต้องรัน evaluator แยกหลังฝึกเสร็จ
checkpoint ที่ฝึกเสร็จแล้วและถูก strip optimizer ใช้เป็นฐาน fine-tune รอบใหม่ ไม่ใช่ resume รอบเดิม

## ชุดภาพทดสอบโทนสีส้มเพิ่มเติม

```powershell
.\.venv\Scripts\python.exe scripts/select_orange_test_slice.py --data datasets/hardhat-vest-v3-sh17/data-focused.yaml --output experiments/orange-ppe-yolo8m-20260909-v2-job/orange-like-test
```

เลือกจาก test เท่านั้น โดยวัดสีภายในกรอบ PPE ที่ dataset ให้มา ไม่ใช้ผลทำนายหรือคะแนนโมเดล
เกณฑ์ OpenCV HSV คือ H 3–20, S 100–255, V 80–255 และพื้นที่สีอย่างน้อย 25% ของกรอบ
ได้ 772 ภาพ มีกรอบที่เข้าเกณฑ์ helmet 1,605 และ safety-vest 377 กรอบ
รายชื่อ SHA-256: `07866b31659c2de574487e3ee0a90f203e1c6b1142e5daf6d0e772f9e1e8a720`

นี่ไม่ใช่ ground truth สีส้ม: มีสีผิว พื้นหลัง และสีเหลืองโทนอุ่นปนได้
ผล evaluator นับทุก annotation ในภาพที่เลือก ไม่ใช่เฉพาะวัตถุสีส้ม
เป็น exploratory slice ของ public test เดิม ไม่ใช่หลักฐานอิสระจากกล้องจริง
ใช้ YAML ในโฟลเดอร์ slice กับ evaluator ทั้ง baseline และ candidate โดยคง imgsz/batch เท่ากัน

## เปรียบเทียบที่ confidence เดียวกัน

นอกเหนือจาก AP ให้วัด raw frame predictions ที่ confidence >= 0.20 และ IoU >= 0.50
โดยใช้เกณฑ์เดียวกันทั้งสองโมเดล ไม่ปรับ threshold จากผล test
`score_ppe_predictions.py` ใช้ `file_name` และ mapping category_id = SH17 class_id + 1
จาก `predictions.json` ของ evaluator; จับคู่กรอบคลาสเดียวกันแบบหนึ่งต่อหนึ่งตามลำดับ confidence

ตัวอย่างสำหรับ baseline (candidate ใช้ `candidate_test_plots` และชื่อ output ใหม่):

```powershell
.\.venv\Scripts\python.exe scripts/score_ppe_predictions.py --predictions experiments/orange-ppe-yolo8m-20260909-v2-job/baseline_test_plots/predictions.json --data datasets/hardhat-vest-v3-sh17/data-focused.yaml --output experiments/orange-ppe-yolo8m-20260909-v2-job/baseline_fixed_threshold.json
```

เพิ่ม `--image-list experiments/orange-ppe-yolo8m-20260909-v2-job/orange-like-test/test.txt`
และใช้ output ชื่อใหม่เพื่อวัดเฉพาะชุดภาพคัดด้วยสี โดยไม่ต้องรัน GPU ซ้ำ
จำนวน TP/FP/FN นี้ยังไม่ใช่การแจ้งเตือนของระบบจริง เพราะไม่มี person association,
การ refine ภาพรายคน หรือการยืนยันเหตุการณ์หลายเฟรม

## ก่อนใช้แทนโมเดลในระบบ

ดู per-class precision/recall/AP ของ helmet และ safety-vest เทียบกับ baseline บนภาพชุดเดียวกัน
ค่า metric ของคลาสที่ไม่มี label ต้องเป็น null; ไม่ใช้ aggregate score อ้างความสามารถตรวจคน
Precision/recall ของ Ultralytics เป็นค่าที่จุด confidence ซึ่งให้ mean F1 สูงสุดในแต่ละ evaluation
จึงไม่ใช่ผลที่ threshold เดียวกับหน้าเว็บ; ใช้ AP50/AP50–95 เป็นหลักในการเทียบ checkpoint
ระบบปัจจุบันมี `yolo11n.pt` ช่วยตรวจคน แต่ยังต้องตรวจผลรวมของทั้งสองโมเดลบนวิดีโอจริง

ยังต้องเพิ่มภาพจากกล้องที่ใช้งานจริง: หมวกส้ม, เสื้อสะท้อนแสงส้มหลายแบบ,
มุมหน้า/หลัง/ด้านข้าง, ระยะใกล้/ไกล, แสงน้อย และตัวอย่างที่ไม่ใช่ PPE เช่นเสื้อยืดส้ม/หมวกแก๊ป
ตีกรอบ `person`, `helmet`, `safety-vest` ให้ครบทุกวัตถุที่เห็น และแบ่งตามกล้อง/วันที่ถ่าย
ล็อก test ก่อนปรับโมเดล; การเพิ่ม epochs เพียงอย่างเดียวไม่รับประกันผลกับกล้องจริง

การทดลองนี้ไม่เขียนทับ weights เดิม ไม่ commit ข้อมูล/โมเดล และไม่เปลี่ยนโมเดลของหน้าเว็บอัตโนมัติ
