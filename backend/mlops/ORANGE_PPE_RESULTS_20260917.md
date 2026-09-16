# ผลการฝึกเพิ่ม PPE สีส้ม — 17 กันยายน 2026

## สรุป

ฝึก YOLOv8m ต่อจาก candidate วันที่ 9 กันยายนครบ 15 epochs โดยใช้ชุดฝึกเน้นสีส้ม
5,000 ภาพไม่ซ้ำ และเลือก `best.pt` จาก validation เดิม โมเดลใหม่ดีขึ้นเพียงเล็กน้อย
และมี trade-off จึงยังไม่เปลี่ยน `MODEL_PATH` ของระบบอัตโนมัติ

ชุด train ประกอบด้วยภาพที่มีเสื้อสะท้อนแสงสีส้มแบบ HSV heuristic 1,237 ภาพ,
ภาพหมวกสีส้ม 3,263 ภาพ และภาพลบที่ไม่มี helmet/vest annotation 500 ภาพ
validation 2,415 ภาพและ test 2,441 ภาพคงเดิมและไม่ถูกนำเข้า train
รายชื่อ train มี SHA-256
`5ca7d11ff35bb91972f2c6539bc44dc3fed4d1d42c9f837f47b717e282da3477`

คำว่า “สีส้ม” ในการทดลองนี้มาจาก OpenCV HSV H 3–20, S 100–255, V 80–255
ภายใน PPE ground-truth box อย่างน้อย 25% ไม่ใช่ color label ที่มนุษย์ตรวจ จึงอาจมีสีผิว,
สนิม, พื้นหลัง หรือสีเหลืองโทนอุ่นปนอยู่

## การฝึก

- Base checkpoint: `experiments/orange-ppe-yolo8m-20260909-v2/weights/best.pt`
- Candidate: `experiments/orange-ppe-yolo8m-20260917-v4/weights/best.pt`
- Best validation epoch: 11
- Validation mAP50: 85.286%
- Validation mAP50–95: 51.604%
- YOLOv8m, imgsz 640, batch 16, freeze 10, AdamW, lr0 0.0001
- ลด color augmentation เป็น hsv_h 0.01, hsv_s 0.35, hsv_v 0.25
- RTX 4070, Ultralytics 8.4.23, CUDA device 0

รอบ `orange-ppe-yolo8m-20260917-v3` หยุดก่อน epoch แรกเพราะ Windows ล็อก
`labels/train.cache` ของ dataset เดิม จึงเก็บรอบนั้นไว้และสร้าง materialized dataset view
ด้วย hard link 19,712 ไฟล์สำหรับรอบ v4 โดยไม่แก้หรือลบ source dataset

## Locked public test เดิม

AP เป็น object-detection metric บน public test ไม่ใช่ความแม่นยำของระบบแจ้งเตือนหรือกล้องจริง

| คลาส | AP50 เดิม → ใหม่ | AP50–95 เดิม → ใหม่ | Precision เดิม → ใหม่ | Recall เดิม → ใหม่ |
|---|---:|---:|---:|---:|
| หมวกนิรภัย | 89.43% → 89.82% | 58.51% → 58.57% | 92.69% → 91.59% | 81.36% → 82.95% |
| เสื้อสะท้อนแสง | 84.88% → 85.12% | 56.38% → 55.97% | 74.52% → 75.28% | 82.30% → 80.67% |

ค่าข้างต้นเป็นจุด confidence ที่ Ultralytics เลือกให้ mean F1 สูงสุดในแต่ละ evaluation
จึงใช้ดูแนวโน้ม AP แต่ห้ามเทียบเป็นผลที่ threshold หน้าเว็บโดยตรง

## ผลที่ confidence 0.20 และ IoU 0.50

### Public test ทั้งหมด 2,441 ภาพ

| คลาส | Precision เดิม → ใหม่ | Recall เดิม → ใหม่ | F1 เดิม → ใหม่ | FP เดิม → ใหม่ | FN เดิม → ใหม่ |
|---|---:|---:|---:|---:|---:|
| หมวกนิรภัย | 86.05% → 84.17% | 85.28% → 86.06% | 85.67% → 85.10% | 929 → 1,088 | 989 → 937 |
| เสื้อสะท้อนแสง | 62.64% → 65.11% | 88.08% → 86.79% | 73.21% → 74.40% | 489 → 433 | 111 → 123 |

### Orange-like test slice เดิม 772 ภาพ

| คลาส | Precision เดิม → ใหม่ | Recall เดิม → ใหม่ | F1 เดิม → ใหม่ | FP เดิม → ใหม่ | FN เดิม → ใหม่ |
|---|---:|---:|---:|---:|---:|
| หมวกนิรภัย | 87.22% → 85.91% | 82.43% → 83.70% | 84.76% → 84.79% | 418 → 475 | 608 → 564 |
| เสื้อสะท้อนแสง | 66.80% → 68.77% | 85.93% → 85.08% | 75.17% → 76.06% | 252 → 228 | 83 → 88 |

โมเดลใหม่เพิ่ม recall หมวกและลด FP ของเสื้อ แต่ยอมเสีย precision หมวกและ recall เสื้อบางส่วน
F1 ของเสื้อสีส้มดีขึ้นประมาณ 0.89 percentage point ส่วนหมวกแทบคงเดิม จึงเป็น improvement
ขนาดเล็ก ไม่ใช่หลักฐานว่าแก้ปัญหากล้องจริงแล้ว

## Artifact และข้อจำกัด

- Candidate size: 52,044,626 bytes
- Candidate SHA-256: `833fa3362afad19f27ff68ac44a52e598d26bd96f7f9f750b5469bd2382e0b9c`
- โมเดลเดิม, dataset เดิม, `.env`, database และหลักฐานเดิมไม่ถูกเขียนทับหรือลบ
- prediction/report อยู่ใน `experiments/orange-ppe-yolo8m-20260917-v4-job/`
- source publisher ระบุ CC0 แต่ archive รวมหลายแหล่งและไม่มี LICENSE ภายใน; ยังไม่ผ่าน commercial gate
- ชุดนี้ไม่มี person ground truth และไม่ได้วัด hybrid person assist, temporal confirmation หรือ false alerts
- ยังไม่มีภาพสีส้มที่มนุษย์ยืนยันจากกล้องเป้าหมาย จึงยังวัด domain shift หน้างานไม่ได้

ขั้นถัดไปที่มีโอกาสช่วยมากกว่าการเพิ่ม public HSV images คือเก็บภาพที่ได้รับอนุญาตจากกล้องจริง
พร้อม label `person`, `helmet`, `safety-vest` และ hard negatives เช่นเสื้อยืดส้ม หมวกแก๊ปส้ม
และวัตถุสีส้ม โดยแบ่ง train/val/test ตามกล้องและวันถ่ายก่อน fine-tune รอบถัดไป
