
import sys
import os
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

# Add the parent directory to sys.path to allow importing app modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.database import Base, engine, SessionLocal
from app.models import StructureNDTStatusRecord, StructureMasterJointList

def inspect_data():
    db = SessionLocal()
    try:
        print("\n--- Inspecting Distinct NDT Types ---")
        distinct_types = db.query(StructureNDTStatusRecord.ndt_type).distinct().all()
        for t in distinct_types:
            print(f"'{t[0]}'")

        print("\n--- Inspecting StructureNDTStatusRecord ---")
        ndt_records = db.query(StructureNDTStatusRecord).all()
        if not ndt_records:
            print("No NDT records found.")
        for record in ndt_records:
            print(f"ID: {record.id}, Project: {record.project_id}, Draw: {record.draw_no}, Joint: {record.joint_no}, Type: '{record.ndt_type}', Report: {record.ndt_report_no}, Result: {record.ndt_result}")

        print("\n--- Inspecting StructureMasterJointList ---")
        joints = db.query(StructureMasterJointList).all()
        if not joints:
            print("No joints found.")
        for joint in joints:
            print(f"ID: {joint.id}, Project: {joint.project_id}, Draw: {joint.draw_no}, Joint: {joint.joint_no}")
            print(f"  RT: {joint.ndt_rt_report_no}/{joint.ndt_rt_result}")
            print(f"  UT: {joint.ndt_ut_report_no}/{joint.ndt_ut_result}")
            print(f"  MPI: {joint.ndt_mpi_report_no}/{joint.ndt_mpi_result}")
            print(f"  PT: {joint.ndt_pt_report_no}/{joint.ndt_pt_result}")
            print(f"  PMI: {joint.ndt_pmi_report_no}/{joint.ndt_pmi_result}")
            print(f"  FT: {joint.ndt_ft_report_no}/{joint.ndt_ft_result}")
            print(f"  PAUT: {joint.ndt_paut_report_no}/{joint.ndt_paut_result}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    inspect_data()
