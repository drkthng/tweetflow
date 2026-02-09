import sqlite3
import os
import json

db_path = os.path.join(os.environ['APPDATA'], 'tweetflow-scheduler', 'tweets.db')

def check_final():
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        print("--- TARGETED TWEET SEARCH ---")
        cursor.execute("SELECT id, status, content, account_id FROM tweets WHERE content LIKE '%Agent test%' ORDER BY id DESC")
        rows = cursor.fetchall()
        print(json.dumps([dict(row) for row in rows], indent=2))
        
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_final()
