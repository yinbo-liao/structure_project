import sys
sys.path.append('.')
from app.database import SessionLocal
from sqlalchemy import text
from datetime import datetime

def simple_ndt_fix():
    db = SessionLocal()
    
    try:
        print("=== Simple NDT Data Fix ===\n")
        
        # Step 1: Check what columns exist in ndt_tests
        print("1. Checking ndt_tests table structure...")
        result = db.execute(text("PRAGMA table_info(ndt_tests)"))
        columns = result.fetchall()
        print("   Columns in ndt_tests table:")
        for col in columns:
            print(f"     {col[0]}: {col[1]} ({col[2]})")
        
        # Step 2: Show current data
        print("\n2. Current NDT tests data:")
        result = db.execute(text("SELECT * FROM ndt_tests"))
        tests = result.fetchall()
        
        for test in tests:
            print(f"   ID: {test[0]}, Project ID: {test[1]}, Final ID: {test[2]}")
            print(f"     Column 3: '{test[3]}'")
            print(f"     Column 4: '{test[4]}'")
            print(f"     Column 5: '{test[5]}'")
            print(f"     Column 6: '{test[6]}'")
            print(f"     Column 7: '{test[7]}'")
            print(f"     Column 8: '{test[8]}'")
            print(f"     Column 9: '{test[9]}'")
            print()
        
        # Step 3: Based on earlier output, we know:
        # - Column 3 contains method (RT, MPI)
        # - Column 4 contains result (accepted)
        # - Column 5 contains report numbers (PIPE-RT002, etc.)
        # - Column 6 is report_no (None)
        # - Column 9 is test_length (datetime)
        
        print("\n3. Creating NDT status records...")
        
        created_count = 0
        for test in tests:
            test_id = test[0]
            project_id = test[1]
            final_id = test[2]
            method = test[3]  # RT, MPI
            result_status = test[4]  # accepted
            report_no = test[5]  # PIPE-RT002, etc.
            test_length = test[9]  # datetime
            
            print(f"\n   Processing test {test_id}:")
            print(f"     Method: {method}, Result: {result_status}, Report No: {report_no}")
            
            # Check if this is a pipe project
            project_result = db.execute(text(f"SELECT project_type FROM projects WHERE id = {project_id}"))
            project_row = project_result.fetchone()
            
            if not project_row:
                print(f"     ⚠ Project {project_id} not found")
                continue
                
            project_type = project_row[0]
            print(f"     Project Type: {project_type}")
            
            if project_type == "pipe":
                # Check if final inspection exists
                final_result = db.execute(text(f"SELECT id FROM pipe_final_inspection WHERE id = {final_id}"))
                final_row = final_result.fetchone()
                
                if not final_row:
                    print(f"     ⚠ Final inspection {final_id} doesn't exist in pipe_final_inspection")
                    # Check if it exists in the old table
                    old_final_result = db.execute(text(f"SELECT id FROM final_inspection WHERE id = {final_id}"))
                    old_final_row = old_final_result.fetchone()
                    if old_final_row:
                        print(f"     ⚠ But exists in old final_inspection table - needs migration")
                    continue
                
                # Get joint information
                joint_result = db.execute(text(f"""
                    SELECT system_no, line_no, spool_no, joint_no, weld_type, welder_no,
                           weld_length, weld_site, pipe_dia, inspection_category
                    FROM pipe_final_inspection 
                    WHERE id = {final_id}
                """))
                joint_row = joint_result.fetchone()
                
                if not joint_row:
                    print(f"     ⚠ Could not get joint information for final {final_id}")
                    continue
                    
                system_no, line_no, spool_no, joint_no, weld_type, welder_no, \
                weld_length, weld_site, pipe_dia, inspection_category = joint_row
                
                # Check if NDT status record already exists
                check_result = db.execute(text(f"""
                    SELECT COUNT(*) FROM pipe_ndt_status_records 
                    WHERE project_id = {project_id} 
                    AND final_id = {final_id}
                    AND ndt_type = '{method}'
                """))
                exists = check_result.fetchone()[0]
                
                if exists == 0:
                    # Create NDT status record
                    insert_query = text(f"""
                        INSERT INTO pipe_ndt_status_records (
                            project_id, final_id, system_no, line_no, spool_no, joint_no,
                            weld_type, welder_no, weld_size, weld_site, pipe_dia,
                            ndt_type, ndt_report_no, ndt_result, rejected_length,
                            inspection_category, created_at, updated_at
                        ) VALUES (
                            {project_id}, {final_id}, 
                            '{system_no or ''}', '{line_no or ''}', '{spool_no or ''}', '{joint_no or ''}',
                            '{weld_type or ''}', '{welder_no or ''}', {weld_length or 0}, '{weld_site or ''}', '{pipe_dia or ''}',
                            '{method}', '{report_no or ''}', '{result_status}', 0.0,
                            '{inspection_category or ''}', '{datetime.utcnow()}', '{datetime.utcnow()}'
                        )
                    """)
                    db.execute(insert_query)
                    created_count += 1
                    print(f"     ✓ Created pipe NDT status record")
                else:
                    print(f"     ⚠ NDT status record already exists")
            
            elif project_type == "structure":
                print(f"     ⚠ Structure project - skipping (not implemented)")
        
        db.commit()
        print(f"\n✓ Created {created_count} new NDT status records")
        
        # Step 4: Verify
        print("\n4. Verification:")
        
        result = db.execute(text("SELECT COUNT(*) FROM pipe_ndt_status_records"))
        total_count = result.fetchone()[0]
        print(f"   Total pipe NDT status records: {total_count}")
        
        if total_count > 0:
            print(f"\n   Sample records:")
            result = db.execute(text("SELECT id, project_id, final_id, ndt_type, ndt_result FROM pipe_ndt_status_records LIMIT 5"))
            records = result.fetchall()
            for rec in records:
                print(f"     ID: {rec[0]}, Project: {rec[1]}, Final: {rec[2]}, Type: {rec[3]}, Result: {rec[4]}")
        
        # Step 5: Test endpoint
        print("\n5. Testing endpoint...")
        
        result = db.execute(text("SELECT id FROM projects WHERE project_type = 'pipe' LIMIT 1"))
        project_row = result.fetchone()
        
        if project_row:
            project_id = project_row[0]
            
            # Simple endpoint test
            query = text(f"""
                SELECT COUNT(*) 
                FROM pipe_ndt_status_records nsr
                JOIN pipe_final_inspection f ON f.id = nsr.final_id
                WHERE nsr.project_id = {project_id}
                AND LOWER(f.final_result) = 'accepted'
            """)
            
            result = db.execute(query)
            count = result.fetchone()[0]
            
            print(f"   Accepted NDT status records for project {project_id}: {count}")
            
            if count > 0:
                print(f"   ✓ Frontend should show data")
            else:
                print(f"   ⚠ Frontend may still show 'No data'")
                print(f"   Check if final inspections are marked as 'accepted'")
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    simple_ndt_fix()
