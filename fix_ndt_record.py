import requests
import json

# Fix the NDT status record by updating it with the correct draw_no
base_url = "http://localhost:8000/api/v1"

# First, let's login to get a token
login_data = {
    "username": "admin@mpdms.com",
    "password": "admin"
}

print("Logging in...")
response = requests.post(f"{base_url}/login", json=login_data)
if response.status_code != 200:
    print(f"Login failed: {response.status_code} - {response.text}")
    exit(1)

token = response.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# 1. Get the NDT status record
print("\n1. Getting NDT status record...")
response = requests.get(f"{base_url}/structure/ndt-status-records", params={"project_id": 1}, headers=headers)
if response.status_code == 200:
    ndt_records = response.json()
    if ndt_records:
        ndt_record = ndt_records[0]
        print(f"Found NDT record: ID={ndt_record.get('id')}, Draw No={ndt_record.get('draw_no')}, Joint No={ndt_record.get('joint_no')}")
        
        # 2. Update the NDT record with correct draw_no
        print("\n2. Updating NDT record with correct draw_no...")
        update_data = {
            "draw_no": "AHZ-302-H-001"  # This should match the master joint
        }
        
        response = requests.put(f"{base_url}/structure/ndt-status-records/{ndt_record['id']}", 
                               json=update_data, headers=headers)
        print(f"Update response status: {response.status_code}")
        if response.status_code == 200:
            print(f"Successfully updated NDT record: {response.json()}")
        else:
            print(f"Error updating NDT record: {response.status_code} - {response.text}")
            
        # 3. Test sync for joint ID 1
        print("\n3. Testing sync for joint ID 1...")
        response = requests.post(f"{base_url}/ndt-sync/sync/joint/1", headers=headers)
        print(f"Sync response status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"Sync result: {json.dumps(result, indent=2)}")
            
            # Check if updates were made
            if result.get('updates_made', False):
                print("\n✓ Sync successful! NDT data should now be updated in master joint.")
            else:
                print("\n⚠ Sync completed but no updates were made.")
        else:
            print(f"Error syncing joint: {response.status_code} - {response.text}")
            
        # 4. Check the master joint after sync
        print("\n4. Checking master joint after sync...")
        response = requests.get(f"{base_url}/structure/master-joint-list/1", headers=headers)
        print(f"Get joint response status: {response.status_code}")
        if response.status_code == 200:
            joint = response.json()
            print(f"Joint after sync:")
            print(f"  - NDT RT Report No: {joint.get('ndt_rt_report_no')}")
            print(f"  - NDT RT Result: {joint.get('ndt_rt_result')}")
            print(f"  - NDT Comprehensive Status: {joint.get('ndt_comprehensive_status')}")
            print(f"  - NDT Last Sync: {joint.get('ndt_last_sync')}")
            print(f"  - NDT Sync Status: {joint.get('ndt_sync_status')}")
    else:
        print("No NDT records found")
else:
    print(f"Error getting NDT records: {response.status_code} - {response.text}")