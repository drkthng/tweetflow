import sqlite3
import os
import json

db_path = os.path.join(os.environ['APPDATA'], 'tweetflow-scheduler', 'tweets.db')

def compare_accounts():
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, name, LENGTH(app_key) as k_len, LENGTH(app_secret) as as_len, LENGTH(access_token) as at_len, LENGTH(access_secret) as asec_len FROM accounts")
        accounts = cursor.fetchall()
        print(json.dumps([dict(a) for a in accounts], indent=2))
        
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    compare_accounts()
