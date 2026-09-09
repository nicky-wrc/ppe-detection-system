# ผลการฝึกเพิ่ม PPE — 9 กันยายน 2026

## สรุป

ฝึก YOLOv8m ต่อจากโมเดลเดิมครบ 20 epochs แล้ว และประเมิน baseline/candidate สำเร็จ
เวลา pipeline เสร็จ: 2026-09-09 19:17:16 Asia/Bangkok
ผลดีขึ้นบน public test ทั้ง helmet และ safety-vest แต่ยังไม่ผ่านการยืนยันกับกล้องจริง
และ **ยังไม่ได้เปลี่ยนโมเดลที่เว็บใช้งาน**

ชุดฝึก 6,676 ภาพ; validation 2,415 ภาพ; test 2,441 ภาพ
test มี helmet 6,721 กรอบ และ safety-vest 931 กรอบ ไม่มี person ground truth
รายละเอียดแหล่งข้อมูล การกันภาพซ้ำ และคำสั่งทำซ้ำ: [คู่มือการฝึก](ORANGE_PPE_TRAINING.md)

## ผลบน public test เดียวกัน

ใช้ imgsz 640, batch 8, workers 0, GPU 0 ทั้งสองโมเดล
AP เป็นคะแนนตรวจจับวัตถุ ไม่ใช่เปอร์เซ็นต์ความถูกต้องของระบบแจ้งเตือน

| คลาส | AP50 เดิม | AP50 ใหม่ | AP50–95 เดิม | AP50–95 ใหม่ |
|---|---:|---:|---:|---:|
| หมวกนิรภัย | 35.54% | 89.43% | 10.86% | 58.51% |
| เสื้อสะท้อนแสง | 51.84% | 84.88% | 28.65% | 56.38% |

ผลต้นทาง: `backend/experiments/orange-ppe-yolo8m-20260909-v2-job/comparison.json`,
`baseline_test.json` และ `candidate_test.json`
คลาส person ในรายงานมี targets=0 และ metric=null ไม่ใช่ผลรับรองการตรวจคน

## ข้อแลกเปลี่ยนที่ confidence เดียวกัน

กำหนด confidence >= 0.20 และ IoU >= 0.50 ไว้ก่อนอ่านผล test
จับคู่กรอบคลาสเดียวกันแบบหนึ่งต่อหนึ่งตามลำดับ confidence
เป็น raw model predictions ไม่ใช่ผล hybrid detector ทั้งระบบ

| คลาส | Precision เดิม → ใหม่ | Recall เดิม → ใหม่ | ตรวจเกิน FP เดิม → ใหม่ | ตรวจพลาด FN เดิม → ใหม่ |
|---|---:|---:|---:|---:|
| หมวกนิรภัย | 57.21% → 86.05% | 20.71% → 85.28% | 1,041 → 929 | 5,329 → 989 |
| เสื้อสะท้อนแสง | 73.03% → 62.64% | 41.89% → 88.08% | 144 → 489 | 541 → 111 |

หมวกดีขึ้นทั้ง precision และ recall ที่เกณฑ์นี้
เสื้อสะท้อนแสงตรวจพลาดน้อยลงมาก แต่ตรวจเกินเพิ่มขึ้นและ precision ลดลง
จึงไม่ควรสลับใช้งานโดยถือว่า confidence เดิมเหมาะสมแล้ว
FP อ้างอิง annotation ของ public dataset ซึ่งอาจไม่ครบ และไม่เท่ากับจำนวน false alerts
baseline runtime ยังมีการรวม safety-suit เป็น safety-vest และ crop refinement ซึ่งไม่ได้รวมใน raw-class score นี้

หลักฐาน: `baseline_fixed_threshold.json`, `candidate_fixed_threshold.json`
ในโฟลเดอร์ job เดียวกัน; predicted-box JSON ต้นทางอยู่ใน `*_test_plots/predictions.json`
image-list LF SHA-256: `b0fdcd793e8104bb30250457b26fe6c5f1f3831dca3dd7c8af42b158acc3b604`

## ชุดภาพคัดด้วยสีเพิ่มเติม

เลือก 772 ภาพจาก test เดิมด้วย HSV ภายในกรอบ PPE โดยไม่ใช้ผลทำนาย
วัดทุก annotation ในภาพที่เลือก ไม่ใช่เฉพาะวัตถุสีส้ม
เกณฑ์สีอาจติดสีผิว ฉากหลัง และสีเหลืองโทนอุ่น จึงห้ามเรียกผลนี้ว่า orange-PPE accuracy

| คลาส | Precision เดิม → ใหม่ | Recall เดิม → ใหม่ |
|---|---:|---:|
| หมวกนิรภัย | 56.81% → 87.22% | 20.86% → 82.43% |
| เสื้อสะท้อนแสง | 73.65% → 66.80% | 39.32% → 85.93% |

ใช้ confidence/IoU เดียวกับตารางก่อนหน้า
หลักฐาน: `baseline_orange_like_fixed_threshold.json`, `candidate_orange_like_fixed_threshold.json`
และ `orange-like-test/selection.json` ในโฟลเดอร์ job

## ไฟล์โมเดลและการรักษาของเดิม

- Candidate: `backend/experiments/orange-ppe-yolo8m-20260909-v2/weights/best.pt`
- ขนาด: 52,045,266 bytes; checkpoint ที่ดีที่สุดมาจาก epoch 20 ตาม validation AP50–95
- Candidate SHA-256: `582e6bedff94f5bdf2d0602bd77aa432039617bae802e4a4f9cfc5745c899d05`
- Baseline: `backend/yolo8m.pt` ไม่ถูกเขียนทับ
- Baseline SHA-256 ก่อนและหลังตรงกัน: `085631758e8e1993159c356b01b5d8b5628cd21e577450b4d3c399d519be4dda`
- `.env`, database, uploads, frontend, runtime detector และสถานะ model-license approval ไม่ถูกเปลี่ยน
- datasets และ checkpoint อยู่ใน Git ignore; ไม่มีการลบไฟล์เดิมหรือ commit/push

ผลนี้เป็นโมเดลทดลอง ไม่ใช่ production release: ผู้เผยแพร่ dataset ระบุ CC0 แต่ archive
รวมหลายแหล่งและไม่มี LICENSE ภายใน; โมเดลตั้งต้น SH17 ยังมีข้อจำกัด research-only เดิม

## Validation และงานถัดไป

Backend tests: `88 passed, 63 warnings` (python-jose UTC deprecation เดิม)
compile checks และ `git diff --check` ผ่าน; ทดสอบ GPU training/evaluation จริงบน RTX 4070
ไม่ได้ทดสอบ browser, USB/RTSP หรือ event-level alert accuracy ด้วยโมเดลใหม่นี้

ก่อนใช้กับระบบจริง ต้องมีภาพที่ได้รับอนุญาตจากกล้องเป้าหมาย พร้อม annotation ครบ
`person`, `helmet`, `safety-vest` และตัวอย่างเสื้อยืดส้ม/หมวกแก๊ป/วัตถุส้มที่ไม่ใช่ PPE
แยก train/validation/test ตามกล้องและวันถ่าย ไม่ใช้เฟรมข้างเคียงข้ามชุด
ปรับ threshold จาก validation เท่านั้น แล้วทดสอบ locked test และ hybrid/temporal pipeline
ต้องตรวจ person regression เพราะการคงชื่อคลาสไม่ได้ป้องกันการลืมคลาสที่ไม่มี label ระหว่างฝึก
ผลจาก public dataset นี้อาจสูงจากฉากที่เกี่ยวข้องกันข้าม split จึงยังใช้ยืนยันผลหน้างานไม่ได้
