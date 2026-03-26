from app.core.database import SessionLocal
from app.models import User
from app.core.security import get_password_hash

def seed_admin():
    db = SessionLocal()
    try:
        admin_exists = db.query(User).filter(User.role == "admin").first()
        if not admin_exists:
            admin = User(
                email="admin@ppe-system.com",
                hashed_password=get_password_hash("admin123"),
                full_name="System Admin",
                role="admin"
            )
            db.add(admin)
            db.commit()
            print("Admin user created successfully!")
        else:
            print("Admin user already exists.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_admin()
