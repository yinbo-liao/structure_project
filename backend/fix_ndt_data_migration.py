import sys
sys.path.append('.')
from app.database import SessionLocal
from sqlalchemy import text
from datetime import datetime

def fix_ndt_data():
    db = SessionLocal()
    
    try:
        print("=== Starting NDT Data Fix Migration ===\n")
        
        # Step 1: Check current state
        print("1. Checking current data state:")
        
        result = db.execute(text("SELECT COUNT(*) FROM ndt_tests"))
        ndt_tests_count = result.fetchone()[0]
        print(f"   NDT tests: {ndt_tests_count}")
        
        result = db.execute(text("SELECT COUNT(*) FROM pipe_ndt_status_records"))
        pipe_status_count = result.fetchone()[0]
        print(f"   Pipe NDT status records: {pipe_status_count}")
        
        result = db.execute(text("SELECT COUNT(*) FROM structure_ndt_status_records"))
        structure_status_count = result.fetchone()[0]
        print(f"   Structure NDT status records: {structure_status_count}")
        
        # Step 2: Fix NDT tests data (swapped columns)
        print("\n2. Fixing NDT tests data (swapped project_type/method columns)...")
        
        # The ndt_tests table has swapped columns:
        # - project_type column contains method values (RT, MPI)
        # - method column contains project_type values (pipe, structure)
        # - result column contains report numbers
        
        # Let's check the actual data structure
        result = db.execute(text("SELECT * FROM ndt_tests LIMIT 1"))
        row = result.fetchone()
        if row:
            print(f"   Sample NDT test row: ID={row[0]}, Project ID={row[1]}, Final ID={row[2]}")
            print(f"   Column 3 (project_type): '{row[3]}'")
            print(f"   Column 4 (method): '{row[4]}'")
            print(f"   Column 5 (result): '{row[5]}'")
            print(f"   Column 6 (report_no): '{row[6]}'")
        
        # Step 3: Create NDT status records from NDT tests
        print("\n3. Creating NDT status records from NDT tests...")
        
        # First, let's get all NDT tests
        result = db.execute(text("""
            SELECT 
                nt.id,
                nt.project_id,
                nt.final_id,
                nt.project_type as actual_method,  -- This column contains method (RT, MPI)
                nt.method as actual_project_type,  -- This column contains project_type (pipe, structure)
                nt.result as actual_report_no,     -- This column contains report numbers
                p.project_type as real_project_type
            FROM ndt_tests nt
            JOIN projects p ON p.id = nt.project_id
        """))
        ndt_tests = result.fetchall()
        
        print(f"   Found {len(ndt_tests)} NDT tests to process")
        
        created_count = 0
        for test in ndt_tests:
            test_id, project_id, final_id, method, project_type_from_method, report_no, real_project_type = test
            
            print(f"\n   Processing NDT test {test_id}:")
            print(f"     Project ID: {project_id}, Final ID: {final_id}")
            print(f"     Method (from project_type column): {method}")
            print(f"     Project Type (from method column): {project_type_from_method}")
            print(f"     Report No (from result column): {report_no}")
            print(f"     Real Project Type: {real_project_type}")
            
            # Determine which table to insert into based on real project type
            if real_project_type == "pipe":
                # Check if final inspection exists
                result = db.execute(text(f"SELECT id FROM pipe_final_inspection WHERE id = {final_id}"))
                final_exists = result.fetchone()
                
                if final_exists:
                    # Get joint information from final inspection
                    result = db.execute(text(f"""
                        SELECT system_no, line_no, spool_no, joint_no, weld_type, welder_no, 
                               weld_length, weld_site, pipe_dia, inspection_category
                        FROM pipe_final_inspection 
                        WHERE id = {final_id}
                    """))
                    final_data = result.fetchone()
                    
                    if final_data:
                        system_no, line_no, spool_no, joint_no, weld_type, welder_no, \
                        weld_length, weld_site, pipe_dia, inspection_category = final_data
                        
                        # Check if NDT status record already exists
                        result = db.execute(text(f"""
                            SELECT COUNT(*) FROM pipe_ndt_status_records 
                            WHERE project_id = {project_id} 
                            AND final_id = {final_id}
                            AND ndt_type = '{method}'
                        """))
                        exists = result.fetchone()[0]
                        
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
                                    '{method}', '{report_no or ''}', 'accepted', 0.0,
                                    '{inspection_category or ''}', '{datetime.utcnow()}', '{datetime.utcnow()}'
                                )
                            """)
                            db.execute(insert_query)
                            created_count += 1
                            print(f"     ✓ Created pipe NDT status record")
                        else:
                            print(f"     ⚠ NDT status record already exists")
                    else:
                        print(f"     ⚠ Final inspection {final_id} not found in pipe_final_inspection")
                else:
                    print(f"     ⚠ Final inspection {final_id} doesn't exist")
            
            elif real_project_type == "structure":
                # Similar logic for structure projects
                print(f"     ⚠ Structure NDT test - skipping (structure tables not implemented yet)")
        
        db.commit()
        print(f"\n   Created {created_count} new NDT status records")
        
        # Step 4: Verify the fix
        print("\n4. Verifying migration results:")
        
        result = db.execute(text("SELECT COUNT(*) FROM pipe_ndt_status_records"))
        new_pipe_status_count = result.fetchone()[0]
        print(f"   Pipe NDT status records after migration: {new_pipe_status_count}")
        
        result = db.execute(text("SELECT COUNT(*) FROM structure_ndt_status_records"))
        new_structure_status_count = result.fetchone()[0]
        print(f"   Structure NDT status records after migration: {new_structure_status_count}")
        
        if new_pipe_status_count > pipe_status_count:
            print(f"\n✓ Migration successful! Created {new_pipe_status_count - pipe_status_count} new records.")
        else:
            print(f"\n⚠ No new records created. This could be because:")
            print(f"   - Final inspections don't exist for the NDT tests")
            print(f"   - NDT status records already exist")
            print(f"   - Data is in structure tables (not implemented)")
        
        # Step 5: Test the endpoint
        print("\n5. Testing NDT status endpoint...")
        
        # Get a pipe project
        result = db.execute(text("SELECT id FROM projects WHERE project_type = 'pipe' LIMIT 1"))
        pipe_project = result.fetchone()
        
        if pipe_project:
            project_id = pipe_project[0]
            
            # Test the endpoint query
            query = text(f"""
                SELECT COUNT(*) 
                FROM pipe_ndt_status_records nsr
                JOIN pipe_final_inspection f ON f.id = nsr.final_id
                LEFT JOIN pipe_ndt_requests nr ON (
                    nr.project_id = nsr.project_id
                    AND nr.system_no = nsr.system_no
                    AND nr.line_no = nsr.line_no
                    AND nr.spool_no = nsr.spool_no
                    AND nr.joint_no = nsr.joint_no
                    AND nr.ndt_type = nsr.ndt_type
                )
                WHERE nsr.project_id = {project_id}
                AND LOWER(f.final_result) = 'accepted'
                AND nr.id IS NOT NULL
                AND nsr.system_no IS NOT NULL
                AND nsr.line_no IS NOT NULL
                AND nsr.spool_no IS NOT NULL
                AND nsr.joint_no IS NOT NULL
                AND nsr.ndt_type IS NOT NULL
            """)
            
            result = db.execute(query)
            endpoint_count = result.fetchone()[0]
            
            print(f"   Endpoint would return {endpoint_count} records for project {project_id}")
            
            if endpoint_count > 0:
                print(f"   ✓ Endpoint would show data in frontend")
            else:
                print(f"   ⚠ Endpoint would still show 'No data'")
                print(f"   Possible reasons:")
                print(f"     - No matching NDT requests")
                print(f"     - Final inspections not 'accepted'")
                print(f"     - Missing joint information")
        
    except Exception as e:
        print(f"\n✗ Error during migration: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_ndt_data()
