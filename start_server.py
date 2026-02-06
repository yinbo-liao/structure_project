import requests
import time
import subprocess
import os
import sys

def check_server():
    print("Checking if server is running...")
    try:
        r = requests.get('http://localhost:8000/', timeout=2)
        print(f"Server is running. Status: {r.status_code}")
        return True
    except Exception as e:
        print(f"Server not running: {e}")
        return False

def start_server():
    print("Starting server...")
    env = os.environ.copy()
    env['USE_SQLITE'] = 'true'
    
    # Start server in background
    process = subprocess.Popen(
        ['python', '-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000'],
        env=env,
        cwd='backend',
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    print(f"Server process started with PID: {process.pid}")
    time.sleep(3)
    
    # Check if server started successfully
    if check_server():
        print("Server started successfully!")
        return True
    else:
        print("Server may have failed to start.")
        return False

if __name__ == "__main__":
    if not check_server():
        start_server()