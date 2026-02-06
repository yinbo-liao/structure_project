#!/usr/bin/env python3
"""
Migration script to copy data from pipe tables to structure tables.
This script should be run after creating the new structure tables in models.py.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os
from app.database import engine, SessionLocal
from app.models import Base, Project as ProjectModel

def migrate_data():
    """Migrate data from pipe tables to structure tables for structure projects."""
    from app.database import SessionLocal
    db = SessionLocal()
    
    try:
        # Get all structure projects
        structure_projects = db.query(ProjectModel).filter(
            ProjectModel.project_type == 'structure'
        ).all()
        
        if not structure_projects:
            print("No structure projects found. Nothing to migrate.")
            return
        
        print(f"Found {len(structure_projects)} structure projects to migrate:")
        for project in structure_projects:
            print(f"  - {project.name} (ID: {project.id})")
        
        # 1. Migrate Master Joint List
        print("\n1. Migrating Master Joint List...")
        db.execute(text("""
            INSERT INTO structure_master_joint_list (
                project_id, draw_no, structure_category, page_no, drawing_rev, joint_no,
                weld_type, weld_length, part1_piece_mark_no, part2_piece_mark_no,
                fit_up_report_no, fitup_status, final_status, inspection_category, created_at
            )
            SELECT 
                project_id, 
                system_no as draw_no,
                system_no as structure_category,
                line_no as page_no,
                spool_no as drawing_rev,
                joint_no,
                weld_type,
                weld_length,
                part1_piece_mark_no,
                part2_piece_mark_no,
                fit_up_report_no,
                fitup_status,
                final_status,
                inspection_category,
                created_at
            FROM master_joint_list
            WHERE project_id IN (SELECT id FROM projects WHERE project_type = 'structure')
            AND NOT EXISTS (
                SELECT 1 FROM structure_master_joint_list smjl 
                WHERE smjl.project_id = master_joint_list.project_id
                AND smjl.draw_no = master_joint_list.system_no
                AND smjl.structure_category = master_joint_list.system_no
                AND smjl.page_no = master_joint_list.line_no
                AND smjl.drawing_rev = master_joint_list.spool_no
                AND smjl.joint_no = master_joint_list.joint_no
            )
        """))
        count_mjl = db.execute(text("SELECT changes()")).scalar()
        print(f"   Migrated {count_mjl} master joint records")
        
        # 2. Migrate Material Inspection
        print("\n2. Migrating Material Inspection...")
        db.execute(text("""
            INSERT INTO structure_material_inspection (
                project_id, material_type, grade, size, width, length, thickness,
                material_spec, report_no, inspection_status, heat_no, quantity,
                inspection_date, remarks, inspector_name, created_at
            )
            SELECT 
                project_id, 
                material_type,
                grade,
                thickness as size,  -- Using thickness as size for structure
                thickness as width,  -- Using thickness as width
                'N/A' as length,  -- Default value
                thickness,
                'N/A' as material_spec,  -- Default value
                report_no,
                result as inspection_status,
                heat_no,
                1 as quantity,  -- Default quantity
                inspection_date,
                remarks,
                inspector_name,
                created_at
            FROM material_inspection
            WHERE project_id IN (SELECT id FROM projects WHERE project_type = 'structure')
            AND NOT EXISTS (
                SELECT 1 FROM structure_material_inspection smi 
                WHERE smi.project_id = material_inspection.project_id
                AND smi.material_type = material_inspection.material_type
                AND smi.grade = material_inspection.grade
                AND smi.heat_no = material_inspection.heat_no
            )
        """))
        count_mi = db.execute(text("SELECT changes()")).scalar()
        print(f"   Migrated {count_mi} material inspection records")
        
        # 3. Migrate Fit-up Inspection
        print("\n3. Migrating Fit-up Inspection...")
        db.execute(text("""
            INSERT INTO structure_fitup_inspection (
                project_id, master_joint_id, draw_no, structure_category, page_no, drawing_rev,
                joint_no, block_no, weld_type, part1_piece_mark_no, part2_piece_mark_no,
                part1_material_type, part1_grade, part1_thickness, part1_heat_no,
                part2_material_type, part2_grade, part2_thickness, part2_heat_no,
                weld_site, weld_length, fit_up_date, fit_up_report_no, fit_up_result,
                remarks, updated_by, inspection_category
            )
            SELECT 
                project_id, master_joint_id,
                system_no as draw_no,
                system_no as structure_category,
                line_no as page_no,
                spool_no as drawing_rev,
                joint_no,
                block_no,
                weld_type,
                part1_piece_mark_no,
                part2_piece_mark_no,
                part1_material_type,
                part1_grade,
                part1_thickness,
                part1_heat_no,
                part2_material_type,
                part2_grade,
                part2_thickness,
                part2_heat_no,
                weld_site,
                weld_length,
                fit_up_date,
                fit_up_report_no,
                fit_up_result,
                remarks,
                updated_by,
                inspection_category
            FROM fitup_inspection
            WHERE project_id IN (SELECT id FROM projects WHERE project_type = 'structure')
            AND NOT EXISTS (
                SELECT 1 FROM structure_fitup_inspection sfi 
                WHERE sfi.project_id = fitup_inspection.project_id
                AND sfi.draw_no = fitup_inspection.system_no
                AND sfi.structure_category = fitup_inspection.system_no
                AND sfi.page_no = fitup_inspection.line_no
                AND sfi.drawing_rev = fitup_inspection.spool_no
                AND sfi.joint_no = fitup_inspection.joint_no
            )
        """))
        count_fitup = db.execute(text("SELECT changes()")).scalar()
        print(f"   Migrated {count_fitup} fit-up inspection records")
        
        # 4. Migrate Final Inspection
        print("\n4. Migrating Final Inspection...")
        db.execute(text("""
            INSERT INTO structure_final_inspection (
                project_id, fitup_id, draw_no, structure_category, page_no, drawing_rev,
                joint_no, block_no, weld_type, wps_no, welder_no, welder_validity,
                weld_site, final_date, final_report_no, final_result, ndt_type,
                weld_length, remarks, inspection_category, created_at
            )
            SELECT 
                project_id, fitup_id,
                system_no as draw_no,
                system_no as structure_category,
                line_no as page_no,
                spool_no as drawing_rev,
                joint_no,
                block_no,
                weld_type,
                wps_no,
                welder_no,
                welder_validity,
                weld_site,
                final_date,
                final_report_no,
                final_result,
                ndt_type,
                weld_length,
                remarks,
                inspection_category,
                created_at
            FROM final_inspection
            WHERE project_id IN (SELECT id FROM projects WHERE project_type = 'structure')
            AND NOT EXISTS (
                SELECT 1 FROM structure_final_inspection sfi 
                WHERE sfi.project_id = final_inspection.project_id
                AND sfi.fitup_id = final_inspection.fitup_id
            )
        """))
        count_final = db.execute(text("SELECT changes()")).scalar()
        print(f"   Migrated {count_final} final inspection records")
        
        # 5. Migrate NDT Requests
        print("\n5. Migrating NDT Requests...")
        db.execute(text("""
            INSERT INTO structure_ndt_requests (
                project_id, project_name, project_code, final_id, draw_no, structure_category,
                page_no, drawing_rev, joint_no, weld_type, weld_process, thickness, welder_no,
                weld_size, ndt_type, inspection_category, status, ndt_result, ndt_report_no,
                request_time, test_time, detail_description, created_at
            )
            SELECT 
                project_id, project_name, project_code, final_id,
                system_no as draw_no,
                system_no as structure_category,
                line_no as page_no,
                spool_no as drawing_rev,
                joint_no,
                weld_type,
                weld_process,
                pipe_dia as thickness,
                welder_no,
                weld_size,
                ndt_type,
                inspection_category,
                status,
                ndt_result,
                ndt_report_no,
                request_time,
                test_time,
                detail_description,
                created_at
            FROM ndt_requests
            WHERE project_id IN (SELECT id FROM projects WHERE project_type = 'structure')
            AND NOT EXISTS (
                SELECT 1 FROM structure_ndt_requests sndtr 
                WHERE sndtr.project_id = ndt_requests.project_id
                AND sndtr.draw_no = ndt_requests.system_no
                AND sndtr.structure_category = ndt_requests.system_no
                AND sndtr.page_no = ndt_requests.line_no
                AND sndtr.drawing_rev = ndt_requests.spool_no
                AND sndtr.joint_no = ndt_requests.joint_no
                AND sndtr.ndt_type = ndt_requests.ndt_type
            )
        """))
        count_ndt = db.execute(text("SELECT changes()")).scalar()
        print(f"   Migrated {count_ndt} NDT request records")
        
        # 6. Update master_joint_id references in structure_fitup_inspection
        print("\n6. Updating master_joint_id references...")
        db.execute(text("""
            UPDATE structure_fitup_inspection
            SET master_joint_id = (
                SELECT smjl.id
                FROM structure_master_joint_list smjl
                WHERE smjl.project_id = structure_fitup_inspection.project_id
                AND smjl.draw_no = structure_fitup_inspection.draw_no
                AND smjl.structure_category = structure_fitup_inspection.structure_category
                AND smjl.page_no = structure_fitup_inspection.page_no
                AND smjl.drawing_rev = structure_fitup_inspection.drawing_rev
                AND smjl.joint_no = structure_fitup_inspection.joint_no
                LIMIT 1
            )
            WHERE master_joint_id IS NULL
        """))
        count_updated = db.execute(text("SELECT changes()")).scalar()
        print(f"   Updated {count_updated} master_joint_id references")
        
        # 7. Update fitup_id references in structure_final_inspection
        print("\n7. Updating fitup_id references...")
        db.execute(text("""
            UPDATE structure_final_inspection
            SET fitup_id = (
                SELECT sfi2.id
                FROM structure_fitup_inspection sfi2
                WHERE sfi2.project_id = structure_final_inspection.project_id
                AND sfi2.id = structure_final_inspection.fitup_id
                LIMIT 1
            )
            WHERE fitup_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM structure_fitup_inspection sfi2
                WHERE sfi2.id = structure_final_inspection.fitup_id
            )
        """))
        count_fitup_refs = db.execute(text("SELECT changes()")).scalar()
        print(f"   Updated {count_fitup_refs} fitup_id references")
        
        # 8. Update final_id references in structure_ndt_requests
        print("\n8. Updating final_id references...")
        db.execute(text("""
            UPDATE structure_ndt_requests
            SET final_id = (
                SELECT sfi.id
                FROM structure_final_inspection sfi
                WHERE sfi.project_id = structure_ndt_requests.project_id
                AND sfi.id = structure_ndt_requests.final_id
                LIMIT 1
            )
            WHERE final_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM structure_final_inspection sfi
                WHERE sfi.id = structure_ndt_requests.final_id
            )
        """))
        count_final_refs = db.execute(text("SELECT changes()")).scalar()
        print(f"   Updated {count_final_refs} final_id references")
        
        db.commit()
        print(f"\n✅ Migration completed successfully!")
        print(f"   Total migrated records:")
        print(f"     - Master Joint List: {count_mjl}")
        print(f"     - Material Inspection: {count_mi}")
        print(f"     - Fit-up Inspection: {count_fitup}")
        print(f"     - Final Inspection: {count_final}")
        print(f"     - NDT Requests: {count_ndt}")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Migration failed: {e}")
        raise
    finally:
        db.close()

def verify_migration():
    """Verify that migration was successful."""
    from app.database import SessionLocal
    db = SessionLocal()
    
    try:
        print("\n🔍 Verifying migration...")
        
        # Count records in original tables for structure projects
        structure_project_ids = [p.id for p in db.query(ProjectModel).filter(
            ProjectModel.project_type == 'structure'
        ).all()]
        
        if not structure_project_ids:
            print("No structure projects found.")
            return
        
        # Count original records
        counts_original = {}
        tables = [
            ('master_joint_list', 'project_id'),
            ('material_inspection', 'project_id'),
            ('fitup_inspection', 'project_id'),
            ('final_inspection', 'project_id'),
            ('ndt_requests', 'project_id')
        ]
        
        for table, id_col in tables:
            query = text(f"SELECT COUNT(*) FROM {table} WHERE {id_col} IN :ids")
            count = db.execute(query, {'ids': tuple(structure_project_ids)}).scalar()
            counts_original[table] = count
        
        # Count migrated records
        counts_migrated = {}
        structure_tables = [
            ('structure_master_joint_list', 'project_id'),
            ('structure_material_inspection', 'project_id'),
            ('structure_fitup_inspection', 'project_id'),
            ('structure_final_inspection', 'project_id'),
            ('structure_ndt_requests', 'project_id')
        ]
        
        for table, id_col in structure_tables:
            query = text(f"SELECT COUNT(*) FROM {table} WHERE {id_col} IN :ids")
            count = db.execute(query, {'ids': tuple(structure_project_ids)}).scalar()
            counts_migrated[table] = count
        
        print("\n📊 Migration Verification Results:")
        print("=" * 60)
        print(f"{'Table':<30} {'Original':<10} {'Migrated':<10} {'Status':<10}")
        print("-" * 60)
        
        all_good = True
        for i, (orig_table, _) in enumerate(tables):
            orig_count = counts_original[orig_table]
            migr_table = structure_tables[i][0]
            migr_count = counts_migrated[migr_table]
            status = "✅ OK" if migr_count >= orig_count else "❌ MISSING"
            if migr_count < orig_count:
                all_good = False
            print(f"{orig_table:<30} {orig_count:<10} {migr_count:<10} {status:<10}")
        
        print("=" * 60)
        
        if all_good:
            print("\n🎉 All data migrated successfully!")
        else:
            print("\n⚠️  Some data may not have been fully migrated.")
            
    finally:
        db.close()

if __name__ == "__main__":
    print("🚀 Starting migration from pipe tables to structure tables...")
    print("=" * 60)
    
    # Run migration
    migrate_data()
    
    # Verify migration
    verify_migration()
    
    print("\n✅ Migration process completed!")
