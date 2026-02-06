#!/usr/bin/env python3
"""
Create test project and data for LNGT TURKIYE (REGAS MODEL)
"""
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta
import random

# Use the same database URL logic as the main app
import os
database_url = os.getenv(
    "DATABASE_URL", 
    "postgresql://postgres:postgres@localhost:5432/project_management"
)

use_sqlite = os.getenv("USE_SQLITE", "false").lower() == "true"
is_testing = os.getenv("TESTING", "false").lower() == "true"

if use_sqlite or is_testing:
    SQLALCHEMY_DATABASE_URL = "sqlite:///./project_management.db"
else:
    SQLALCHEMY_DATABASE_URL = database_url

# Import models
from app.models import (
    Project, User, StructureMasterJointList, StructureMaterialRegister,
    StructureFitUpInspection, StructureFinalInspection, StructureNDTRequest,
    StructureNDTStatusRecord, NDTTest, WPSRegister, WelderRegister
)
from app.auth import get_password_hash

def create_test_data():
    """Create test project and data."""
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    print("=== Creating Test Data for LNGT TURKIYE Project ===")
    
    try:
        # Check if project already exists
        existing_project = session.query(Project).filter(Project.code == 'LNGT-TURKIYE').first()
        if existing_project:
            print(f"Project already exists: {existing_project.name} (ID: {existing_project.id})")
            project = existing_project
        else:
            # Create project
            project = Project(
                name="LNGT TURKIYE (REGAS MODEL)",
                code="LNGT-TURKIYE",
                description="LNG Terminal Turkey Regasification Module Project",
                project_type="structure",
                owner_id=1  # Assuming admin user ID is 1
            )
            session.add(project)
            session.commit()
            session.refresh(project)
            print(f"Created project: {project.name} (ID: {project.id})")
        
        # Create master joint list
        print("\nCreating master joint list...")
        joints_created = 0
        for i in range(1, 101):  # 100 joints
            joint = StructureMasterJointList(
                project_id=project.id,
                draw_no=f"DRW-{random.randint(1000, 1999)}",
                structure_category=random.choice(['A-Frame', 'B-Frame', 'C-Frame', 'D-Frame']),
                page_no=f"P{random.randint(1, 50)}",
                block_no=f"BLK-{random.randint(1, 20)}",
                joint_no=f"JNT-{i:03d}",
                weld_type=random.choice(['Butt Weld', 'Fillet Weld', 'Socket Weld']),
                weld_length=random.uniform(50, 500),
                thickness=random.uniform(5, 25),
                material_grade=random.choice(['ASTM A36', 'ASTM A572', 'ASTM A992']),
                inspection_category=random.choice(['type-I', 'type-II', 'type-III'])
            )
            session.add(joint)
            joints_created += 1
        
        session.commit()
        print(f"Created {joints_created} master joints")
        
        # Create material register
        print("\nCreating material register...")
        materials_created = 0
        for i in range(1, 51):  # 50 materials
            material = StructureMaterialRegister(
                project_id=project.id,
                piece_mark_no=f"PM-{i:04d}",
                material_grade=random.choice(['ASTM A36', 'ASTM A572', 'ASTM A992']),
                thickness=random.uniform(5, 25),
                length=random.uniform(1000, 6000),
                width=random.uniform(100, 500),
                quantity=random.randint(1, 10),
                inspection_status=random.choice(['pending', 'inspected', 'rejected']),
                inspection_date=datetime.now() - timedelta(days=random.randint(1, 30)) if random.random() > 0.3 else None,
                inspector_name=random.choice(['John Doe', 'Jane Smith', 'Bob Johnson']) if random.random() > 0.3 else None
            )
            session.add(material)
            materials_created += 1
        
        session.commit()
        print(f"Created {materials_created} material records")
        
        # Create fit-up inspections (60% of joints)
        print("\nCreating fit-up inspections...")
        fitup_created = 0
        joints = session.query(StructureMasterJointList).filter(StructureMasterJointList.project_id == project.id).all()
        for i, joint in enumerate(joints[:60]):  # 60 fit-ups
            fitup = StructureFitUpInspection(
                project_id=project.id,
                master_joint_id=joint.id,
                draw_no=joint.draw_no,
                structure_category=joint.structure_category,
                page_no=joint.page_no,
                block_no=joint.block_no,
                joint_no=joint.joint_no,
                fit_up_report_no=f"FIT-{i+1:04d}",
                fit_up_date=datetime.now() - timedelta(days=random.randint(1, 60)),
                fit_up_result=random.choice(['accepted', 'rejected', 'pending']),
                inspector_name=random.choice(['John Doe', 'Jane Smith', 'Bob Johnson']),
                remarks="Test fit-up inspection" if random.random() > 0.5 else None
            )
            session.add(fitup)
            fitup_created += 1
        
        session.commit()
        print(f"Created {fitup_created} fit-up inspections")
        
        # Create final inspections (40% of fit-ups)
        print("\nCreating final inspections...")
        final_created = 0
        fitups = session.query(StructureFitUpInspection).filter(
            StructureFitUpInspection.project_id == project.id,
            StructureFitUpInspection.fit_up_result == 'accepted'
        ).all()
        
        for i, fitup in enumerate(fitups[:24]):  # 40% of 60 = 24 finals
            final = StructureFinalInspection(
                project_id=project.id,
                fit_up_id=fitup.id,
                draw_no=fitup.draw_no,
                structure_category=fitup.structure_category,
                page_no=fitup.page_no,
                block_no=fitup.block_no,
                joint_no=fitup.joint_no,
                final_report_no=f"FIN-{i+1:04d}",
                final_date=datetime.now() - timedelta(days=random.randint(1, 30)),
                final_result=random.choice(['accepted', 'rejected']),
                welder_no=f"WELD-{random.randint(100, 199)}",
                wps_no=f"WPS-{random.randint(1, 20)}",
                weld_length=random.uniform(50, 500),
                weld_site=random.choice(['shop weld', 'float weld']),
                inspector_name=random.choice(['John Doe', 'Jane Smith', 'Bob Johnson']),
                remarks="Test final inspection"
            )
            session.add(final)
            final_created += 1
        
        session.commit()
        print(f"Created {final_created} final inspections")
        
        # Create NDT tests
        print("\nCreating NDT tests...")
        ndt_tests_created = 0
        finals = session.query(StructureFinalInspection).filter(
            StructureFinalInspection.project_id == project.id,
            StructureFinalInspection.final_result == 'accepted'
        ).all()
        
        # Define NDT methods with their characteristics
        ndt_methods = [
            ('RT', 'length', 100),  # RT: length-based, 100mm typical test length
            ('UT', 'length', 80),   # UT: length-based, 80mm typical test length
            ('MPI', 'length', 50),  # MPI: length-based, 50mm typical test length
            ('PT', 'length', 40),   # PT: length-based, 40mm typical test length
            ('PMI', 'joint', 0),    # PMI: joint-based
            ('FT', 'joint', 0)      # FT: joint-based
        ]
        
        for final in finals:
            # Each final gets 2-4 NDT tests
            num_tests = random.randint(2, 4)
            selected_methods = random.sample(ndt_methods, num_tests)
            
            for method, method_type, typical_length in selected_methods:
                if method_type == 'length':
                    test_length = random.uniform(typical_length * 0.8, typical_length * 1.2)
                    result = random.choices(['accepted', 'rejected'], weights=[0.95, 0.05])[0]
                else:
                    test_length = 0  # Joint-based methods don't have length
                    result = random.choices(['accepted', 'rejected'], weights=[0.97, 0.03])[0]
                
                ndt_test = NDTTest(
                    project_id=project.id,
                    final_id=final.id,
                    method=method,
                    test_length=test_length if method_type == 'length' else None,
                    result=result,
                    report_no=f"NDT-{method}-{ndt_tests_created+1:04d}",
                    test_date=datetime.now() - timedelta(days=random.randint(1, 15)),
                    inspector_name=random.choice(['John Doe', 'Jane Smith', 'Bob Johnson'])
                )
                session.add(ndt_test)
                ndt_tests_created += 1
        
        session.commit()
        print(f"Created {ndt_tests_created} NDT tests")
        
        # Create NDT status records
        print("\nCreating NDT status records...")
        ndt_status_created = 0
        for final in finals:
            # Get NDT tests for this final
            tests = session.query(NDTTest).filter(
                NDTTest.project_id == project.id,
                NDTTest.final_id == final.id
            ).all()
            
            if tests:
                # Combine methods
                methods = ', '.join(sorted(set(t.method for t in tests)))
                # Calculate rejected length
                rejected_length = sum(t.test_length or 0 for t in tests if t.result == 'rejected')
                
                ndt_status = StructureNDTStatusRecord(
                    project_id=project.id,
                    final_id=final.id,
                    system_no=final.draw_no,
                    line_no=final.structure_category,
                    spool_no=final.page_no,
                    joint_no=final.joint_no,
                    weld_type=random.choice(['Butt Weld', 'Fillet Weld', 'Socket Weld']),
                    welder_no=final.welder_no,
                    weld_size=final.weld_length,
                    weld_site=final.weld_site,
                    ndt_type=methods,
                    ndt_report_no=f"NDT-STATUS-{ndt_status_created+1:04d}",
                    ndt_result='rejected' if rejected_length > 0 else 'accepted',
                    rejected_length=rejected_length,
                    weld_length=final.weld_length
                )
                session.add(ndt_status)
                ndt_status_created += 1
        
        session.commit()
        print(f"Created {ndt_status_created} NDT status records")
        
        # Create NDT requests
        print("\nCreating NDT requests...")
        ndt_requests_created = 0
        for final in finals:
            ndt_request = StructureNDTRequest(
                project_id=project.id,
                final_id=final.id,
                system_no=final.draw_no,
                line_no=final.structure_category,
                spool_no=final.page_no,
                joint_no=final.joint_no,
                weld_type=random.choice(['Butt Weld', 'Fillet Weld', 'Socket Weld']),
                welder_no=final.welder_no,
                weld_size=final.weld_length,
                ndt_type=random.choice(['RT', 'UT', 'MPI', 'PT', 'PMI', 'FT']),
                status=random.choice(['pending', 'approved', 'rejected']),
                request_time=datetime.now() - timedelta(days=random.randint(5, 20)),
                requested_by=random.choice(['John Doe', 'Jane Smith', 'Bob Johnson'])
            )
            session.add(ndt_request)
            ndt_requests_created += 1
        
        session.commit()
        print(f"Created {ndt_requests_created} NDT requests")
        
        # Create WPS register
        print("\nCreating WPS register...")
        wps_created = 0
        for i in range(1, 21):  # 20 WPS
            wps = WPSRegister(
                project_id=project.id,
                wps_no=f"WPS-{i}",
                revision=f"Rev {random.randint(0, 3)}",
                material_grade=random.choice(['ASTM A36', 'ASTM A572', 'ASTM A992']),
                thickness_range=f"{random.uniform(5, 10):.1f}-{random.uniform(20, 25):.1f} mm",
                process=random.choice(['SMAW', 'GMAW', 'FCAW', 'GTAW']),
                status=random.choice(['active', 'inactive']),
                qualification_date=datetime.now() - timedelta(days=random.randint(30, 365))
            )
            session.add(wps)
            wps_created += 1
        
        session.commit()
        print(f"Created {wps_created} WPS records")
        
        # Create welder register
        print("\nCreating welder register...")
        welders_created = 0
        for i in range(100, 120):  # 20 welders
            welder = WelderRegister(
                project_id=project.id,
                welder_no=f"WELD-{i}",
                full_name=random.choice(['John Smith', 'Jane Doe', 'Bob Wilson', 'Alice Johnson', 'Charlie Brown']),
                qualification_no=f"QUAL-{random.randint(1000, 9999)}",
                process=random.choice(['SMAW', 'GMAW', 'FCAW', 'GTAW']),
                material_grade=random.choice(['ASTM A36', 'ASTM A572', 'ASTM A992']),
                thickness_range=f"{random.uniform(5, 10):.1f}-{random.uniform(20, 25):.1f} mm",
                status=random.choice(['active', 'inactive']),
                expiry_date=datetime.now() + timedelta(days=random.randint(30, 365))
            )
            session.add(welder)
            welders_created += 1
        
        session.commit()
        print(f"Created {welders_created} welder records")
        
        print("\n=== Test Data Creation Complete ===")
        print(f"Project: {project.name} (ID: {project.id})")
        print(f"Total joints: {joints_created}")
        print(f"Fit-up inspections: {fitup_created}")
        print(f"Final inspections: {final_created}")
        print(f"NDT tests: {ndt_tests_created}")
        print(f"NDT status records: {ndt_status_created}")
        print(f"NDT requests: {ndt_requests_created}")
        print(f"Material records: {materials_created}")
        print(f"WPS records: {wps_created}")
        print(f"Welder records: {welders_created}")
        
        # Calculate some statistics
        print("\n=== Sample Statistics ===")
        
        # NDT reject rates
        rt_tests = session.query(NDTTest).filter(
            NDTTest.project_id == project.id,
            NDTTest.method == 'RT'
        ).all()
        if rt_tests:
            rt_total = sum(t.test_length or 0 for t in rt_tests)
            rt_rejected = sum(t.test_length or 0 for t in rt_tests if t.result == 'rejected')
            rt_rate = (rt_rejected / rt_total * 100) if rt_total > 0 else 0
            print(f"RT reject rate: {rt_rate:.1f}% ({rt_rejected:.1f} mm / {rt_total:.1f} mm)")
        
        ut_tests = session.query(NDTTest).filter(
            NDTTest.project_id == project.id,
            NDTTest.method == 'UT'
        ).all()
        if ut_tests:
            ut_total = sum(t.test_length or 0 for t in ut_tests)
            ut_rejected = sum(t.test_length or 0 for t in ut_tests if t.result == 'rejected')
            ut_rate = (ut_rejected / ut_total * 100) if ut_total > 0 else 0
            print(f"UT reject rate: {ut_rate:.1f}% ({ut_rejected:.1f} mm / {ut_total:.1f} mm)")
        
        mpi_tests = session.query(NDTTest).filter(
            NDTTest.project_id == project.id,
            NDTTest.method == 'MPI'
        ).all()
        if mpi_tests:
            mpi_total = sum(t.test_length or 0 for t in mpi_tests)
            mpi_rejected = sum(t.test_length or 0 for t in mpi_tests if t.result == 'rejected')
            mpi_rate = (mpi_rejected / mpi_total * 100) if mpi_total > 0 else 0
            print(f"MPI reject rate: {mpi_rate:.1f}% ({mpi_rejected:.1f} mm / {mpi_total:.1f} mm)")
        
        pt_tests = session.query(NDTTest).filter(
            NDTTest.project_id == project.id,
            NDTTest.method == 'PT'
        ).all()
        if pt_tests:
            pt_total = sum(t.test_length or 0 for t in pt_tests)
            pt_rejected = sum(t.test_length or 0 for t in pt_tests if t.result == 'rejected')
            pt_rate = (pt_rejected / pt_total * 100) if pt_total > 0 else 0
            print(f"PT reject rate: {pt_rate:.1f}% ({pt_rejected:.1f} mm / {pt_total:.1f} mm)")
        
        # Joint-based methods
        pmi_tests = session.query(NDTTest).filter(
            NDTTest.project_id == project.id,
            NDTTest.method == 'PMI'
        ).all()
        if pmi_tests:
            pmi_total = len(pmi_tests)
            pmi_rejected = len([t for t in pmi_tests if t.result == 'rejected'])
            pmi_rate = (pmi_rejected / pmi_total * 100) if pmi_total > 0 else 0
            print(f"PMI reject rate: {pmi_rate:.1f}% ({pmi_rejected} joints / {pmi_total} joints)")
        
        ft_tests = session.query(NDTTest).filter(
            NDTTest.project_id == project.id,
            NDTTest.method == 'FT'
        ).all()
        if ft_tests:
            ft_total = len(ft_tests)
            ft_rejected = len([t for t in ft_tests if t.result == 'rejected'])
            ft_rate = (ft_rejected / ft_total * 100) if ft_total > 0 else 0
            print(f"FT reject rate: {ft_rate:.1f}% ({ft_rejected} joints / {ft_total} joints)")
        
        print("\n=== Ready for Testing ===")
        print(f"Dashboard URL: http://localhost:3000/dashboard")
        print(f"NDT Status URL: http://localhost:3000/structureproject/ndt-status")
        
    except Exception as e:
        print(f"Error creating test data: {e}")
        import traceback
        traceback.print_exc()
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    create_test_data()
