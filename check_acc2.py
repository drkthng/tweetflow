import sqlite3
import os
import json

db_path = os.path.join(os.environ['APPDATA'], 'tweetflow-scheduler', 'tweets.db')

def check_account_2():
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        print("--- ACCOUNT 2 (Compoundeng) LAST TWEETS ---")
        cursor.execute("SELECT id, status, error_message, content FROM tweets WHERE account_id = 2 ORDER BY id DESC LIMIT 5")
        rows = cursor.fetchall()
        print(json.dumps([dict(row) for row in rows], indent=2))
        
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_account_2()
