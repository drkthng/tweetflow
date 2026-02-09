import sqlite3
import os

db_path = os.path.join(os.environ['APPDATA'], 'tweetflow-scheduler', 'tweets.db')

def fix_schema():
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("PRAGMA table_info(tweets)")
        cols = [c[1] for c in cursor.fetchall()]
        
        if 'error_message' not in cols:
            print("Adding error_message column...")
            cursor.execute("ALTER TABLE tweets ADD COLUMN error_message TEXT")
            
        if 'account_id' not in cols:
            print("Adding account_id column...")
            cursor.execute("ALTER TABLE tweets ADD COLUMN account_id INTEGER")
            
        conn.commit()
        print("Schema fix complete.")
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fix_schema()
