import requests
import json

try:
    r = requests.get('http://localhost:8000/openapi.json')
    print(f'Status: {r.status_code}')
    if r.status_code == 200:
        data = r.json()
        paths = list(data.get('paths', {}).keys())
        print(f'Total paths: {len(paths)}')
        print('\nFirst 30 paths:')
        for p in paths[:30]:
            print(f'  {p}')
        
        # Check for inspection endpoints
        print('\nInspection endpoints:')
        inspection_paths = [p for p in paths if 'inspections' in p]
        for p in inspection_paths:
            print(f'  {p}')
            
        # Check for master-joint-list specifically
        print('\nMaster joint list endpoints:')
        master_joint_paths = [p for p in paths if 'master-joint-list' in p]
        for p in master_joint_paths:
            print(f'  {p}')
    else:
        print(f'Error: {r.text}')
except Exception as e:
    print(f'Exception: {e}')
