#!/usr/bin/env python3
"""
Simple verification that the schema fix has been applied.
This script checks that the MasterJointList schema includes the new fields.
"""

import sys
import os

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

try:
    from app.schemas import MasterJointList
    
    # Check if the schema has the new fields
    schema_fields = MasterJointList.model_fields.keys()
    
    print("=== Schema Verification ===")
    print(f"MasterJointList schema has {len(schema_fields)} fields")
    
    # Check for the new fields
    new_fields = ['weld_site', 'draw_no', 'part1_piece_mark_no', 'part2_piece_mark_no']
    
    print("\nChecking for new fields:")
    all_present = True
    for field in new_fields:
        if field in schema_fields:
            print(f"✓ {field} is present in schema")
        else:
            print(f"✗ {field} is MISSING from schema")
            all_present = False
    
    # Create a test instance
    print("\n=== Test Instance Creation ===")
    test_data = {
        "id": 1,
        "project_id": 1,
        "system_no": "SYS-01",
        "line_no": "LINE-01",
        "spool_no": "SPL-001",
        "joint_no": "JNT-001",
        "pipe_dia": "DN100",
        "weld_type": "BUTT",
        "weld_site": "shop",
        "weld_length": 150.0,
        "fit_up_report_no": "FIT-001",
        "fitup_status": "pending",
        "final_status": "pending",
        "inspection_category": "type-I",
        "draw_no": "DWG-001",
        "part1_piece_mark_no": "PM-001",
        "part2_piece_mark_no": "PM-002",
        "created_at": "2024-01-20T10:00:00"
    }
    
    try:
        joint = MasterJointList(**test_data)
        print("✓ Test instance created successfully")
        print(f"  weld_site value: {joint.weld_site}")
        print(f"  draw_no value: {joint.draw_no}")
        print(f"  part1_piece_mark_no value: {joint.part1_piece_mark_no}")
        print(f"  part2_piece_mark_no value: {joint.part2_piece_mark_no}")
    except Exception as e:
        print(f"✗ Failed to create test instance: {e}")
        all_present = False
    
    print("\n=== Summary ===")
    if all_present:
        print("✅ Schema fix has been successfully applied!")
        print("\nThe 'Error fetching master joints' issue should now be resolved.")
        print("The frontend should now receive all required fields from the API.")
        sys.exit(0)
    else:
        print("❌ Schema fix is incomplete or failed.")
        sys.exit(1)
        
except ImportError as e:
    print(f"Error importing schemas: {e}")
    print("Make sure you're running this from the project root directory.")
    sys.exit(1)
except Exception as e:
    print(f"Unexpected error: {e}")
    sys.exit(1)
