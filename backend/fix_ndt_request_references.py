"""
Fix NDTRequest references in inspections.py
The code is trying to query NDTRequest which doesn't exist as a SQLAlchemy model.
We need to update these references to query both PipeNDTRequest and StructureNDTRequest.
"""

import re

def fix_inspections_py():
    with open('app/routes/inspections.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix 1: Line with db.query(NDTRequest).filter(NDTRequest.final_id == final.id).delete(synchronize_session=False)
    # Replace with code that deletes from both tables
    pattern1 = r'db\.query\(NDTRequest\)\.filter\(NDTRequest\.final_id == final\.id\)\.delete\(synchronize_session=False\)'
    replacement1 = '''# Delete from both pipe and structure NDT request tables
    db.query(PipeNDTRequest).filter(PipeNDTRequest.final_id == final.id).delete(synchronize_session=False)
    db.query(StructureNDTRequest).filter(StructureNDTRequest.final_id == final.id).delete(synchronize_session=False)'''
    
    content = re.sub(pattern1, replacement1, content)
    
    # Fix 2: Line with req = db.query(NDTRequest).filter(NDTRequest.final_id == rec.final_id, NDTRequest.ndt_type == method).first()
    pattern2 = r'req = db\.query\(NDTRequest\)\.filter\(NDTRequest\.final_id == rec\.final_id, NDTRequest\.ndt_type == method\)\.first\(\)'
    replacement2 = '''# Try to find NDT request in both pipe and structure tables
    req = db.query(PipeNDTRequest).filter(PipeNDTRequest.final_id == rec.final_id, PipeNDTRequest.ndt_type == method).first()
    if not req:
        req = db.query(StructureNDTRequest).filter(StructureNDTRequest.final_id == rec.final_id, StructureNDTRequest.ndt_type == method).first()'''
    
    content = re.sub(pattern2, replacement2, content)
    
    # Fix 3: The longer query at line 1318
    # This is more complex - we need to find and replace the entire block
    pattern3 = r'ndt_request = db\.query\(NDTRequest\)\.filter\(\s*NDTRequest\.project_id == record\.project_id,\s*NDTRequest\.system_no == record\.system_no,\s*NDTRequest\.line_no == record\.line_no,\s*NDTRequest\.spool_no == record\.spool_no,\s*NDTRequest\.joint_no == record\.joint_no,\s*NDTRequest\.ndt_type == record\.ndt_type\s*\)\.first\(\)'
    
    replacement3 = '''# Try to find NDT request in both pipe and structure tables
    ndt_request = db.query(PipeNDTRequest).filter(
        PipeNDTRequest.project_id == record.project_id,
        PipeNDTRequest.system_no == record.system_no,
        PipeNDTRequest.line_no == record.line_no,
        PipeNDTRequest.spool_no == record.spool_no,
        PipeNDTRequest.joint_no == record.joint_no,
        PipeNDTRequest.ndt_type == record.ndt_type
    ).first()
    if not ndt_request:
        ndt_request = db.query(StructureNDTRequest).filter(
            StructureNDTRequest.project_id == record.project_id,
            StructureNDTRequest.system_no == record.system_no,
            StructureNDTRequest.line_no == record.line_no,
            StructureNDTRequest.spool_no == record.spool_no,
            StructureNDTRequest.joint_no == record.joint_no,
            StructureNDTRequest.ndt_type == record.ndt_type
        ).first()'''
    
    content = re.sub(pattern3, replacement3, content, flags=re.DOTALL)
    
    # Write the fixed content back
    with open('app/routes/inspections.py', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("Fixed NDTRequest references in inspections.py")

if __name__ == "__main__":
    fix_inspections_py()
