import requests
import json

def test_welder_creation():
    url = "http://localhost:8000/api/v1/welder-register"
    headers = {"Content-Type": "application/json"}
    data = {
        "project_id": 1,
        "welder_no": "TEST123",
        "qualification": "SMAW",
        "validity": "2G/3G/4G",
        "status": "active"
    }
    
    try:
        response = requests.post(url, json=data, headers=headers)
        if response.status_code == 200:
            print("✅ Success: Welder created successfully!")
            print("Response:", response.json())
        else:
            print(f"❌ Error: Failed to create welder (Status: {response.status_code})")
            print("Response:", response.text)
    except Exception as e:
        print(f"❌ Exception: {e}")

if __name__ == "__main__":
    test_welder_creation()
