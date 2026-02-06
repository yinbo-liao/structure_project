import sys
sys.path.append('.')
from app.database import SessionLocal
from sqlalchemy import text

def cleanup_test_data():
    db = SessionLocal()
    
    try:
        print("Cleaning up test data...")
        
        # Delete test data in reverse order (due to foreign key constraints)
        db.execute(text("DELETE FROM pipe_ndt_status_records WHERE system_no = 'TEST-SYS'"))
        db.execute(text("DELETE FROM pipe_ndt_requests WHERE system_no = 'TEST-SYS'"))
        db.execute(text("DELETE FROM pipe_final_inspection WHERE system_no = 'TEST-SYS'"))
        db.execute(text("DELETE FROM pipe_fitup_inspection WHERE system_no = 'TEST-SYS'"))
        
        db.commit()
        print("Test data cleaned up successfully")
        
        # Verify cleanup
        print("\nVerifying cleanup:")
        tables = ["pipe_fitup_inspection", "pipe_final_inspection", "pipe_ndt_requests", "pipe_ndt_status_records"]
        for table in tables:
            result = db.execute(text(f"SELECT COUNT(*) FROM {table} WHERE system_no = 'TEST-SYS'"))
            count = result.fetchone()[0]
            print(f"  {table}: {count} test records remaining")
            
    except Exception as e:
        print(f"Error cleaning up test data: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    cleanup_test_data()
