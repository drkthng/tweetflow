import sqlite3
import os
import json

db_path = os.path.join(os.environ['APPDATA'], 'tweetflow-scheduler', 'tweets.db')

def check_errors():
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Check if error_message column exists
        cursor.execute("PRAGMA table_info(tweets)")
        cols = [c['name'] for c in cursor.fetchall()]
        
        query = "SELECT id, status, content, account_id"
        if 'error_message' in cols:
            query += ", error_message"
            
        query += " FROM tweets WHERE content LIKE '%Agent test%' ORDER BY id DESC"
        
        cursor.execute(query)
        rows = cursor.fetchall()
        print(json.dumps([dict(row) for row in rows], indent=2))
        
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_errors()
