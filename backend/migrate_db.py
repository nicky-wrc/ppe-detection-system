"""
สคริปต์สำหรับ migrate ฐานข้อมูล
เพิ่มคอลัมน์ใหม่ในตาราง detections
"""
from sqlalchemy import text
from app.core.database import engine

def migrate():
    print("🔄 Starting database migration...")
    
    with engine.connect() as conn:
        # เพิ่มคอลัมน์ persons ถ้ายังไม่มี
        try:
            conn.execute(text("""
                ALTER TABLE detections 
                ADD COLUMN IF NOT EXISTS persons JSON DEFAULT '[]'::json
            """))
            print("✅ Added column: persons")
        except Exception as e:
            print(f"⚠️ Column persons: {e}")
        
        # เพิ่มคอลัมน์ summary ถ้ายังไม่มี
        try:
            conn.execute(text("""
                ALTER TABLE detections 
                ADD COLUMN IF NOT EXISTS summary JSON
            """))
            print("✅ Added column: summary")
        except Exception as e:
            print(f"⚠️ Column summary: {e}")
        
        conn.commit()
    
    print("✅ Migration complete!")

if __name__ == "__main__":
    migrate()
