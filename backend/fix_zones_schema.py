"""Fix zones table schema - add missing columns"""
import psycopg2

DB_URL = "postgresql://postgres:postgres@localhost:5432/ppe_detection"

def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    # Check existing columns
    cur.execute("""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'zones' ORDER BY ordinal_position
    """)
    existing = [row[0] for row in cur.fetchall()]
    print(f"Existing columns: {existing}")
    
    # Columns to add (matching Zone model)
    columns_to_add = {
        "polygon_points": "JSON DEFAULT '[]'",
        "required_ppe": "JSON DEFAULT '[]'",
        "rules_config": "JSON DEFAULT '{}'",
        "is_active": "BOOLEAN DEFAULT TRUE",
        "risk_level": "VARCHAR(20) DEFAULT 'medium'",
        "total_violations": "INTEGER DEFAULT 0",
        "description": "TEXT",
        "created_at": "TIMESTAMP WITH TIME ZONE DEFAULT NOW()",
        "updated_at": "TIMESTAMP WITH TIME ZONE",
    }
    
    for col, col_type in columns_to_add.items():
        if col not in existing:
            sql = f"ALTER TABLE zones ADD COLUMN {col} {col_type}"
            print(f"Adding column: {col} ({col_type})")
            cur.execute(sql)
        else:
            print(f"Column already exists: {col}")
    
    conn.commit()
    print("\nDone! Updated columns:")
    cur.execute("""
        SELECT column_name, data_type FROM information_schema.columns 
        WHERE table_name = 'zones' ORDER BY ordinal_position
    """)
    for row in cur.fetchall():
        print(f"  - {row[0]}: {row[1]}")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
