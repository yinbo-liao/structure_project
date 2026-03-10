from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Body
from fastapi.responses import PlainTextResponse, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from typing import Optional, List
import re
import math
import csv
import io
import logging
import os
import json
import pandas as pd
from datetime import datetime
from app.database import get_db
from app.models import (
    StructureMasterJointList, StructureMaterialRegister,
    StructureFitUpInspection, StructureFinalInspection, StructureNDTRequest,
    NDTTest, StructureNDTStatusRecord, WPSRegister, WelderRegister, NDTRequirement,
    User as UserModel, Project as ProjectModel, NDTTypes
)
from app.schemas import (
    StructureMasterJoint as StructureMasterJointSchema, StructureMasterJointCreate,
    StructureMaterialRegister as StructureMaterialRegisterSchema, StructureMaterialRegisterCreate,
    StructureFitUpInspection as StructureFitUpInspectionSchema, StructureFitUpInspectionCreate,
    StructureFinalInspection as StructureFinalInspectionSchema, StructureFinalInspectionCreate,
    StructureNDTRequest as StructureNDTRequestSchema, StructureNDTRequestCreate,
    NDTTest as NDTTestSchema, NDTTestCreate, StructureNDTStatusRecord as StructureNDTStatusRecordSchema
)
from app.auth import get_current_user, require_editor, require_admin
from sqlalchemy.orm import joinedload

router = APIRouter()

# Simple file-based audit logging (JSON Lines per entity)
def _audit_snapshot(obj):
    try:
        return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
    except Exception:
        return {}

def _audit_write(kind: str, entry: dict):
    try:
        base_dir = os.path.dirname(os.path.dirname(__file__))
        log_dir = os.path.join(base_dir, "logs")
        os.makedirs(log_dir, exist_ok=True)
        date_tag = datetime.utcnow().strftime('%Y-%m-%d')
        path = os.path.join(log_dir, f"{date_tag}.log")
        line = (
            f"{entry.get('ts')} [{kind}] {entry.get('action')} "
            f"id={entry.get('id')} project_id={entry.get('project_id')} user={entry.get('user')} "
            f"before={json.dumps(entry.get('before', {}), default=str)} "
            f"after={json.dumps(entry.get('after', {}), default=str)}\n"
        )
        with open(path, "a", encoding="utf-8") as f:
            f.write(line)
    except Exception:
        pass

def _audit(kind: str, action: str, user, before=None, after=None, record_id: Optional[int] = None, project_id: Optional[int] = None):
    try:
        entry = {
            "ts": datetime.utcnow().isoformat(),
            "entity": kind,
            "action": action,
            "id": record_id,
            "project_id": project_id,
            "user": getattr(user, "email", None),
            "before": before,
            "after": after,
        }
        _audit_write(kind, entry)
    except Exception:
        pass

# Audit log endpoints (admin-only)
@router.get("/audit-logs/dates")
def list_audit_log_dates(
    current_user: UserModel = Depends(require_admin)
):
    base_dir = os.path.dirname(os.path.dirname(__file__))
    log_dir = os.path.join(base_dir, "logs")
    try:
        files = os.listdir(log_dir)
    except Exception:
        files = []
    dates = [f.replace('.log','') for f in files if f.endswith('.log')]
    return sorted(dates)

@router.get("/audit-logs/{date}")
def get_audit_log_by_date(
    date: str,
    current_user: UserModel = Depends(require_admin)
):
    # rudimentary validation YYYY-MM-DD
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
        raise HTTPException(status_code=400, detail="Invalid date format")
    base_dir = os.path.dirname(os.path.dirname(__file__))
    path = os.path.join(base_dir, "logs", f"{date}.log")
    if not os.path.exists(path):
        return PlainTextResponse("", status_code=200)
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    return PlainTextResponse(content, status_code=200)

# Structure Master Joint List Routes
@router.get("/structure/master-joint-list", response_model=List[StructureMasterJointSchema])
def get_structure_master_joint_list(
    skip: int = 0,
    limit: int = 20000,
    project_id: Optional[int] = Query(None),
    structure_category: Optional[str] = Query(None),
    page_no: Optional[str] = Query(None),
    block_no: Optional[str] = Query(None),
    joint_no: Optional[str] = Query(None),
    exclude_with_fitup: bool = Query(False, description="Exclude joints that already have fit-up records"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    query = db.query(StructureMasterJointList)
    
    # Filter by project access
    if project_id:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        if current_user.role != 'admin' and project not in current_user.assigned_projects:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
        query = query.filter(StructureMasterJointList.project_id == project_id)
    else:
        # Only show master joints for projects user has access to
        if current_user.role != 'admin':
            user_project_ids = [p.id for p in current_user.assigned_projects]
            query = query.filter(StructureMasterJointList.project_id.in_(user_project_ids))
    
    # Additional filters
    if structure_category:
        query = query.filter(StructureMasterJointList.structure_category == structure_category)
    if page_no:
        query = query.filter(StructureMasterJointList.page_no.contains(page_no))
    if block_no:
        query = query.filter(StructureMasterJointList.block_no == block_no)
    if joint_no:
        query = query.filter(StructureMasterJointList.joint_no == joint_no)
    
    # Exclude joints that already have fit-up records
    if exclude_with_fitup:
        # Get all joints that have fit-up records
        joints_with_fitup = db.query(StructureFitUpInspection).filter(
            StructureFitUpInspection.project_id == project_id
        ).with_entities(
            StructureFitUpInspection.draw_no,
            StructureFitUpInspection.structure_category,
            StructureFitUpInspection.page_no,
            StructureFitUpInspection.drawing_rev,
            StructureFitUpInspection.joint_no
        ).distinct().all()
        
        # Create a set of tuples for quick lookup
        fitup_joints_set = {
            (fitup.draw_no, fitup.structure_category, fitup.page_no, fitup.drawing_rev, fitup.joint_no)
            for fitup in joints_with_fitup
            if all([fitup.draw_no, fitup.structure_category, fitup.page_no, fitup.drawing_rev, fitup.joint_no])
        }
        
        # Filter out joints that are in the fitup set
        if fitup_joints_set:
            # We need to filter in the query itself
            from sqlalchemy import not_, and_
            
            # Create a subquery or filter condition
            conditions = []
            for draw_no, structure_category, page_no, drawing_rev, joint_no in fitup_joints_set:
                conditions.append(
                    and_(
                        StructureMasterJointList.draw_no == draw_no,
                        StructureMasterJointList.structure_category == structure_category,
                        StructureMasterJointList.page_no == page_no,
                        StructureMasterJointList.drawing_rev == drawing_rev,
                        StructureMasterJointList.joint_no == joint_no
                    )
                )
            
            if conditions:
                # Combine conditions with OR and negate with NOT
                combined_condition = or_(*conditions)
                query = query.filter(not_(combined_condition))
    
    return query.offset(skip).limit(limit).all()

@router.post("/structure/master-joint-list", response_model=StructureMasterJointSchema)
def create_structure_master_joint(
    master_joint: StructureMasterJointCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    # Verify project access
    project = db.query(ProjectModel).filter(ProjectModel.id == master_joint.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    data = master_joint.model_dump()
    # Remove fields that are in schema but not in model
    if 'weld_site' in data:
        del data['weld_site']
        
    db_master_joint = StructureMasterJointList(**data)
    db.add(db_master_joint)
    db.commit()
    db.refresh(db_master_joint)
    return db_master_joint

@router.put("/structure/master-joint-list/{joint_id}", response_model=StructureMasterJointSchema)
def update_structure_master_joint(
    joint_id: int,
    joint_update: dict,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    joint = db.query(StructureMasterJointList).filter(StructureMasterJointList.id == joint_id).first()
    if not joint:
        raise HTTPException(status_code=404, detail="Structure master joint not found")
    project = db.query(ProjectModel).filter(ProjectModel.id == joint.project_id).first()
    if current_user.role != 'admin' and project.id not in [p.id for p in current_user.assigned_projects]:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")

    update_data = joint_update if isinstance(joint_update, dict) else joint_update.model_dump(exclude_unset=True)
    immutable = {"id", "project_id", "created_at"}
    for k, v in update_data.items():
        if k in immutable:
            continue
        setattr(joint, k, v)
    db.commit()
    db.refresh(joint)
    return joint

@router.delete("/structure/master-joint-list/{joint_id}")
def delete_structure_master_joint(
    joint_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_admin)
):
    joint = db.query(StructureMasterJointList).filter(StructureMasterJointList.id == joint_id).first()
    if not joint:
        raise HTTPException(status_code=404, detail="Structure master joint not found")
    project = db.query(ProjectModel).filter(ProjectModel.id == joint.project_id).first()
    if current_user.role != 'admin' and project.id not in [p.id for p in current_user.assigned_projects]:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    db.delete(joint)
    db.commit()
    return {"message": "Structure master joint deleted successfully"}

@router.post("/structure/master-joint-list/upload")
def upload_structure_master_joint_list(
    project_id: int = Query(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    # Verify project access
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    allowed_types = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    if (file.content_type not in allowed_types) and (not file.filename.endswith(('.csv', '.xlsx', '.xls'))):
        raise HTTPException(status_code=400, detail="File must be CSV or Excel format")
    
    try:
        raw = file.file.read()
        if len(raw) > 20 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large (max 20MB)")
        records: List[dict] = []
        name = (file.filename or '').lower()
        if name.endswith('.csv'):
            content = raw.decode('utf-8', errors='ignore').lstrip('\ufeff')
            sample = content[:1024]
            try:
                dialect = csv.Sniffer().sniff(sample)
                csv_reader = csv.DictReader(io.StringIO(content), dialect=dialect)
            except Exception:
                delim = '\t' if '\t' in sample else ','
                csv_reader = csv.DictReader(io.StringIO(content), delimiter=delim)
            records = list(csv_reader)
        else:
            df = pd.read_excel(io.BytesIO(raw))
            records = df.to_dict(orient='records')

        def norm_key(k: str) -> str:
            return (str(k or '')).strip().lower().replace(' ', '_').replace('-', '_')

        syn = {
            'draw_no': ['draw_no', 'drawing_no'],
            'structure_category': ['structure_category', 'system_no', 'structure'],
            'page_no': ['page_no', 'line_no', 'page'],
            'drawing_rev': ['drawing_rev', 'spool_no', 'revision', 'rev'],
            'joint_no': ['joint_no'],
            'block_no': ['block_no', 'block'],
            'thickness': ['thickness', 'size'],
            'weld_type': ['weld_type'],
            'weld_length': ['weld_length', 'length'],
            'part1_piece_mark_no': ['part1_piece_mark_no', 'part_1_piece_mark', 'part1_piece_mark'],
            'part2_piece_mark_no': ['part2_piece_mark_no', 'part_2_piece_mark', 'part2_piece_mark'],
            'fitup_status': ['fitup_status', 'fit_up_status'],
            'final_status': ['final_status'],
            'fit_up_report_no': ['fit_up_report_no', 'fitup_report_no', 'fit up report no'],
            'final_report_no': ['final_report_no', 'final report no'],
            'inspection_category': ['inspection_category', 'category']
        }

        def get_val(nrow: dict, keys: List[str]):
            for k in keys:
                if k in nrow and nrow[k] is not None:
                    return nrow[k]
            return None

        columns_norm = set()
        for r in records:
            columns_norm.update(norm_key(k) for k in r.keys())
        required_groups = ['draw_no', 'structure_category', 'page_no', 'drawing_rev', 'joint_no']
        missing = []
        for g in required_groups:
            if not any(k in columns_norm for k in syn[g]):
                missing.append(g)
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing required columns: {', '.join(required_groups)}")

        created_count = 0
        errors: List[str] = []
        for index, row in enumerate(records, start=2):
            try:
                nrow = {norm_key(k): v for k, v in row.items()}
                master_joint_data = {
                    'project_id': project_id,
                    'draw_no': str(get_val(nrow, syn['draw_no']) or '').strip(),
                    'structure_category': str(get_val(nrow, syn['structure_category']) or '').strip(),
                    'page_no': str(get_val(nrow, syn['page_no']) or '').strip(),
                    'drawing_rev': str(get_val(nrow, syn['drawing_rev']) or '').strip(),
                    'joint_no': str(get_val(nrow, syn['joint_no']) or '').strip(),
                    'block_no': (str(get_val(nrow, syn['block_no']) or '').strip() or None),
                    'thickness': (str(get_val(nrow, syn['thickness']) or '').strip() or None),
                    'weld_type': (str(get_val(nrow, syn['weld_type']) or '').strip() or None),
                    'weld_length': (float(get_val(nrow, syn['weld_length'])) if get_val(nrow, syn['weld_length']) else None),
                    'part1_piece_mark_no': (str(get_val(nrow, syn['part1_piece_mark_no']) or '').strip() or None),
                    'part2_piece_mark_no': (str(get_val(nrow, syn['part2_piece_mark_no']) or '').strip() or None),
                    'fit_up_report_no': (str(get_val(nrow, syn['fit_up_report_no']) or '').strip() or None),
                    'final_report_no': (str(get_val(nrow, syn['final_report_no']) or '').strip() or None),
                    'fitup_status': (str(get_val(nrow, syn['fitup_status']) or 'pending').strip() or 'pending'),
                    'final_status': (str(get_val(nrow, syn['final_status']) or 'pending').strip() or 'pending'),
                    'inspection_category': (str(get_val(nrow, syn['inspection_category']) or 'type-I').strip() or 'type-I')
                }
                if not all([master_joint_data['draw_no'], master_joint_data['structure_category'], master_joint_data['page_no'], master_joint_data['drawing_rev'], master_joint_data['joint_no']]):
                    raise ValueError('Required fields missing')
                existing_joint = db.query(StructureMasterJointList).filter(
                    StructureMasterJointList.project_id == project_id,
                    StructureMasterJointList.draw_no == master_joint_data['draw_no'],
                    StructureMasterJointList.structure_category == master_joint_data['structure_category'],
                    StructureMasterJointList.page_no == master_joint_data['page_no'],
                    StructureMasterJointList.drawing_rev == master_joint_data['drawing_rev'],
                    StructureMasterJointList.joint_no == master_joint_data['joint_no']
                ).first()
                if existing_joint:
                    for key, value in master_joint_data.items():
                        if key != 'project_id':
                            setattr(existing_joint, key, value)
                else:
                    db.add(StructureMasterJointList(**master_joint_data))
                created_count += 1
            except Exception as e:
                errors.append(f"Row {index}: {str(e)}")
        db.commit()
        return {"message": f"Successfully processed {created_count} structure joints", "created_count": created_count, "errors": errors or None}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing file: {str(e)}")

# Structure Material Register Routes
@router.get("/structure/material-register", response_model=List[StructureMaterialRegisterSchema])
def get_structure_material_register(
    skip: int = 0,
    limit: int = Query(100, ge=1, le=1000, description="Number of records to return (1-1000)"),
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    query = db.query(StructureMaterialRegister)
    
    if project_id:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        if current_user.role != 'admin' and project not in current_user.assigned_projects:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
        query = query.filter(StructureMaterialRegister.project_id == project_id)
    else:
        if current_user.role != 'admin':
            user_project_ids = [p.id for p in current_user.assigned_projects]
            query = query.filter(StructureMaterialRegister.project_id.in_(user_project_ids))
    
    return query.offset(skip).limit(limit).all()

@router.post("/structure/material-register", response_model=StructureMaterialRegisterSchema)
def create_structure_material_register(
    material: StructureMaterialRegisterCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == material.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Validate structure category if provided
    allowed_structure_categories = ['type-i', 'type-ii', 'type-iii', 'Special']
    if material.structure_category and material.structure_category not in allowed_structure_categories:
        raise HTTPException(
            status_code=400,
            detail=f'structure_category must be one of: {", ".join(allowed_structure_categories)}'
        )
    
    # Check for duplicate piece mark number in the same project
    existing_material = db.query(StructureMaterialRegister).filter(
        StructureMaterialRegister.project_id == material.project_id,
        StructureMaterialRegister.piece_mark_no == material.piece_mark_no
    ).first()
    
    if existing_material:
        raise HTTPException(
            status_code=400,
            detail=f"Material with piece mark number '{material.piece_mark_no}' already exists in this project"
        )
    
    try:
        db_material = StructureMaterialRegister(**material.model_dump())
        db.add(db_material)
        db.commit()
        db.refresh(db_material)
        return db_material
    except Exception as e:
        db.rollback()
        # Check if it's a unique constraint violation
        error_str = str(e).lower()
        if "unique" in error_str or "duplicate" in error_str:
            raise HTTPException(
                status_code=400,
                detail=f"Material with piece mark number '{material.piece_mark_no}' already exists in this project"
            )
        else:
            # Log the actual error for debugging
            logging.error(f"Database error creating material register: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail="Database error occurred while creating material record"
            )

@router.post("/structure/material-register/upload")
def upload_structure_material_register(
    project_id: int = Query(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if current_user.role != 'admin' and project.id not in [p.id for p in current_user.assigned_projects]:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    
    allowed_types = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
    if (file.content_type not in allowed_types) and (not file.filename.endswith(('.csv', '.xlsx', '.xls'))):
        raise HTTPException(status_code=400, detail="File must be CSV or Excel format")
    raw = file.file.read()
    if len(raw) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 20MB)")
    
    records: List[dict] = []
    name = (file.filename or '').lower()
    if name.endswith('.csv'):
        content = raw.decode('utf-8', errors='ignore').lstrip('\ufeff')
        if (not content.strip()) or (raw[:2] in (b'\xff\xfe', b'\xfe\xff')):
            try:
                content = raw.decode('utf-16', errors='ignore').lstrip('\ufeff')
            except Exception:
                pass
        sample = content[:1024]
        try:
            dialect = csv.Sniffer().sniff(sample)
            csv_reader = csv.DictReader(io.StringIO(content), dialect=dialect)
            records = list(csv_reader)
        except Exception:
            try:
                delim = '\t' if '\t' in sample else ','
                csv_reader = csv.DictReader(io.StringIO(content), delimiter=delim)
                records = list(csv_reader)
            except Exception:
                try:
                    enc = 'utf-16' if raw[:2] in (b'\xff\xfe', b'\xfe\xff') else 'utf-8'
                    df = pd.read_csv(io.BytesIO(raw), engine='python', encoding=enc)
                    records = df.to_dict(orient='records')
                except Exception as e:
                    raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")
    elif name.endswith('.xlsx') or name.endswith('.xlsm'):
        try:
            df = pd.read_excel(io.BytesIO(raw), engine='openpyxl')
        except ImportError:
            raise HTTPException(status_code=400, detail="Excel parsing requires 'openpyxl' for .xlsx/.xlsm")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse Excel (.xlsx/.xlsm): {str(e)}")
        records = df.to_dict(orient='records')
    elif name.endswith('.xls'):
        try:
            df = pd.read_excel(io.BytesIO(raw), engine='xlrd')
        except ImportError:
            raise HTTPException(status_code=400, detail="Excel parsing requires 'xlrd' for .xls")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse Excel (.xls): {str(e)}")
        records = df.to_dict(orient='records')
    else:
        raise HTTPException(status_code=400, detail="Unsupported file format. Use CSV, .xlsx, .xlsm, or .xls")
    
    def _norm_key(k: str) -> str:
        s = str(k or '').strip().lower().replace(' ', '_').lstrip('\ufeff')
        synonyms = {
            'piece_mark': 'piece_mark_no',
            'piece_mark_no': 'piece_mark_no',
            'piece_mark_number': 'piece_mark_no',
            'piece_no': 'piece_mark_no',
            'pm': 'piece_mark_no',
            'pm_no': 'piece_mark_no',
            'piece': 'piece_mark_no',
            'material_type': 'material_type',
            'material': 'material_type',
            'grade': 'grade',
            'thickness': 'thickness',
            'thk': 'thickness',
            'heat_no': 'heat_no',
            'heat_number': 'heat_no',
            'category': 'structure_category',
            'structure_category': 'structure_category',
            'structure_categor': 'structure_category',  # Added for "Structure Categor" spelling
            'structure_cat': 'structure_category',
            'struct_category': 'structure_category',
            'structure': 'structure_category',
            'structure_spec': 'structure_spec',
            'spec': 'structure_spec',
            'specification': 'structure_spec',
            'block_no': 'block_no',
            'block': 'block_no',
            'blk_no': 'block_no',
            'blk': 'block_no',
            'drawing_no': 'drawing_no',
            'drawing': 'drawing_no',
            'drawing_rev': 'drawing_rev',
            'rev': 'drawing_rev',
            'material_report_no': 'material_report_no',
            'material_report': 'material_report_no',
            'inspection_status': 'inspection_status',
            'status': 'inspection_status',
        }
        return synonyms.get(s, s)
    
    created_count = 0
    updated_count = 0
    errors: List[str] = []
    
    # Define allowed values for structure category (optional)
    allowed_structure_categories = ['type-i', 'type-ii', 'type-iii', 'Special']
    
    for idx, row in enumerate(records, start=2):
        try:
            nrow = { _norm_key(k): v for k, v in (row or {}).items() }
            piece = str(nrow.get('piece_mark_no', '')).strip()
            category = str(nrow.get('structure_category', '')).strip()
            spec_val = str(nrow.get('structure_spec', '')).strip()
            
            if not piece:
                raise ValueError('piece_mark_no required')
            
            # Structure Category is now optional but must be one of allowed values if provided
            if category and category not in allowed_structure_categories:
                raise ValueError(f'structure_category must be one of: {", ".join(allowed_structure_categories)}')
            
            # structure_spec is now optional - no validation required
            
            data = {
                'project_id': project_id,
                'piece_mark_no': piece,
                'material_type': (str(nrow.get('material_type', '')).strip() or None),
                'grade': (str(nrow.get('grade', '')).strip() or None),
                'thickness': (str(nrow.get('thickness', '')).strip() or None),
                'heat_no': (str(nrow.get('heat_no', '')).strip() or None),
                'structure_spec': (spec_val or None),
                'structure_category': category,
                'drawing_no': (str(nrow.get('drawing_no', '')).strip() or None),
                'drawing_rev': (str(nrow.get('drawing_rev', '')).strip() or None),
                'block_no': (str(nrow.get('block_no', '')).strip() or None),
                'material_report_no': (str(nrow.get('material_report_no', '')).strip() or None),
                'inspection_status': (str(nrow.get('inspection_status', 'pending')).strip() or 'pending')
            }
            
            s = (data['inspection_status'] or 'pending').lower()
            if s not in ('pending', 'inspected', 'rejected'):
                s = 'pending'
            data['inspection_status'] = s
            
            # Limit to model columns
            model_columns = {c.name for c in StructureMaterialRegister.__table__.columns}
            final_data = {k: v for k, v in data.items() if k in model_columns}
            # Upsert by piece_mark_no
            target = db.query(StructureMaterialRegister).filter(
                StructureMaterialRegister.project_id == project_id,
                StructureMaterialRegister.piece_mark_no == piece
            ).first()
            if target:
                for k, v in final_data.items():
                    if k != 'project_id' and v is not None:
                        setattr(target, k, v)
                updated_count += 1
            else:
                target = StructureMaterialRegister(**final_data)
                db.add(target)
                created_count += 1
        except Exception as e:
            errors.append(f"Row {idx}: {str(e)}")
    
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to save materials: {str(e)}")
    
    return {"created": created_count, "updated": updated_count, "errors": errors or None}
@router.put("/structure/material-register/{material_id}", response_model=StructureMaterialRegisterSchema)
def update_structure_material_register(
    material_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    rec = db.query(StructureMaterialRegister).filter(StructureMaterialRegister.id == material_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Material record not found")
    project = db.query(ProjectModel).filter(ProjectModel.id == rec.project_id).first()
    if current_user.role != 'admin' and project.id not in [p.id for p in current_user.assigned_projects]:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    
    # Validate structure category if provided in payload
    allowed_structure_categories = ['type-i', 'type-ii', 'type-iii', 'Special']
    if 'structure_category' in payload and payload['structure_category'] and payload['structure_category'] not in allowed_structure_categories:
        raise HTTPException(
            status_code=400,
            detail=f'structure_category must be one of: {", ".join(allowed_structure_categories)}'
        )
    
    # Exclude read-only fields
    excluded_fields = {'id', 'project_id', 'created_at', 'updated_at', 'created_by', 'updated_by'}
    
    for k, v in payload.items():
        if k in excluded_fields:
            continue

        # Handle field mapping from frontend to backend
        if k == 'spec':
            k = 'structure_spec'
        
        if hasattr(rec, k):
            setattr(rec, k, v)
    
    try:
        db.commit()
        db.refresh(rec)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error occurred: {str(e)}")
        
    return rec

@router.delete("/structure/material-register/{material_id}")
def delete_structure_material_register(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    rec = db.query(StructureMaterialRegister).filter(StructureMaterialRegister.id == material_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Material record not found")
    project = db.query(ProjectModel).filter(ProjectModel.id == rec.project_id).first()
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    db.delete(rec)
    db.commit()
    return {"message": "Structure material record deleted successfully"}

# Structure Fit-up Inspection Routes
@router.get("/structure/fitup-inspection", response_model=List[StructureFitUpInspectionSchema])
def get_structure_fitup_inspections(
    skip: int = 0,
    limit: int = 20000,
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    query = db.query(StructureFitUpInspection)
    
    if project_id:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        if current_user.role != 'admin' and project not in current_user.assigned_projects:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
        query = query.filter(StructureFitUpInspection.project_id == project_id)
    else:
        if current_user.role != 'admin':
            user_project_ids = [p.id for p in current_user.assigned_projects]
            query = query.filter(StructureFitUpInspection.project_id.in_(user_project_ids))
    
    return query.offset(skip).limit(limit).all()

@router.get("/structure/fitup-inspection/filters")
def get_structure_fitup_filters(
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    query = db.query(StructureFitUpInspection)
    if project_id:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        if current_user.role != 'admin' and project not in current_user.assigned_projects:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
        query = query.filter(StructureFitUpInspection.project_id == project_id)
    else:
        if current_user.role != 'admin':
            user_project_ids = [p.id for p in current_user.assigned_projects]
            query = query.filter(StructureFitUpInspection.project_id.in_(user_project_ids))

    rows = query.all()
    def uniq(vals):
        return sorted([v for v in set([str(x).strip() for x in vals if x]) if v])

    return {
        "structure_category": uniq([r.structure_category for r in rows]),
        "drawing_rev": uniq([r.drawing_rev for r in rows]),
        "joint_no": uniq([r.joint_no for r in rows]),
        "fit_up_report_no": uniq([r.fit_up_report_no for r in rows]),
        "fit_up_result": uniq([r.fit_up_result for r in rows])
    }

@router.get("/structure/fitup-inspection/pending-final", response_model=List[StructureFitUpInspectionSchema])
def get_pending_final_inspections(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")

    # Subquery for existing final inspections fitup_ids
    existing_finals = db.query(StructureFinalInspection.fitup_id).filter(
        StructureFinalInspection.project_id == project_id,
        StructureFinalInspection.fitup_id.isnot(None)
    )
    
    # Query fitups: accepted and not in final inspections
    pending_fitups = db.query(StructureFitUpInspection).filter(
        StructureFitUpInspection.project_id == project_id,
        func.lower(StructureFitUpInspection.fit_up_result) == 'accepted',
        ~StructureFitUpInspection.id.in_(existing_finals)
    ).all()
    
    return pending_fitups

@router.post("/structure/fitup-inspection", response_model=StructureFitUpInspectionSchema)
def create_structure_fitup_inspection(
    fitup: StructureFitUpInspectionCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    try:
        project = db.query(ProjectModel).filter(ProjectModel.id == fitup.project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check if joint already has fit-up record
        if fitup.draw_no and fitup.structure_category and fitup.page_no and fitup.drawing_rev and fitup.joint_no:
            existing_fitup = db.query(StructureFitUpInspection).filter(
                StructureFitUpInspection.project_id == fitup.project_id,
                StructureFitUpInspection.draw_no == fitup.draw_no,
                StructureFitUpInspection.structure_category == fitup.structure_category,
                StructureFitUpInspection.page_no == fitup.page_no,
                StructureFitUpInspection.drawing_rev == fitup.drawing_rev,
                StructureFitUpInspection.joint_no == fitup.joint_no
            ).first()
            
            if existing_fitup:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Joint {fitup.joint_no} already has a fit-up record (ID: {existing_fitup.id})"
                )
        
        fitup_data = fitup.model_dump()
        if fitup_data.get("fit_up_date"):
            try:
                val = fitup_data["fit_up_date"]
                if isinstance(val, str):
                    fitup_data["fit_up_date"] = datetime.fromisoformat(val.replace("Z", "+00:00"))
            except Exception:
                fitup_data["fit_up_date"] = None
        
        db_fitup = StructureFitUpInspection(**fitup_data)
        db.add(db_fitup)
        db.commit()
        db.refresh(db_fitup)
        
        # Update master joint status
        try:
            joint = None
            if db_fitup.master_joint_id:
                joint = db.query(StructureMasterJointList).filter(StructureMasterJointList.id == db_fitup.master_joint_id).first()
            if not joint:
                joint = db.query(StructureMasterJointList).filter(
                    StructureMasterJointList.project_id == db_fitup.project_id,
                    StructureMasterJointList.draw_no == (db_fitup.draw_no or ""),
                    StructureMasterJointList.structure_category == (db_fitup.structure_category or ""),
                    StructureMasterJointList.page_no == (db_fitup.page_no or ""),
                    StructureMasterJointList.drawing_rev == (db_fitup.drawing_rev or ""),
                    StructureMasterJointList.joint_no == (db_fitup.joint_no or "")
                ).first()
            if joint:
                if db_fitup.fit_up_report_no:
                    joint.fit_up_report_no = db_fitup.fit_up_report_no
                if (db_fitup.fit_up_result or '').lower() == 'accepted' and db_fitup.fit_up_report_no:
                    joint.fitup_status = db_fitup.fit_up_report_no
                db.commit()
        except Exception as e:
            # Log error but don't fail the operation
            logging.warning(f"Failed to update master joint status: {str(e)}")
        
        return db_fitup
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logging.error(f"Error creating structure fit-up inspection: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to create fit-up inspection: {str(e)}"
        )

@router.put("/structure/fitup-inspection/{fitup_id}", response_model=StructureFitUpInspectionSchema)
def update_structure_fitup_inspection(
    fitup_id: int,
    fitup_update: dict,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    fitup = db.query(StructureFitUpInspection).filter(StructureFitUpInspection.id == fitup_id).first()
    if not fitup:
        raise HTTPException(status_code=404, detail="Structure fit-up inspection not found")
    
    # Check project access
    project = db.query(ProjectModel).filter(ProjectModel.id == fitup.project_id).first()
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    
    if (current_user.role or '').lower() == 'inspector':
        s = (fitup.fit_up_result or '').lower()
        if s == 'accepted':
            raise HTTPException(status_code=403, detail="Not authorized to edit accepted fit-up as inspector")
    
    update_data = fitup_update if isinstance(fitup_update, dict) else fitup_update.model_dump(exclude_unset=True)
    immutable = {'id', 'project_id', 'created_at'}
    for k in list(update_data.keys()):
        if k in immutable:
            update_data.pop(k, None)
    
    # Handle datetime conversion for fit_up_date
    if "fit_up_date" in update_data and update_data["fit_up_date"]:
        try:
            val = update_data["fit_up_date"]
            if isinstance(val, str):
                from datetime import datetime
                update_data["fit_up_date"] = datetime.fromisoformat(val.replace("Z", "+00:00"))
        except Exception:
            update_data["fit_up_date"] = None
    
    before = _audit_snapshot(fitup)
    
    for field, value in update_data.items():
        setattr(fitup, field, value)
    try:
        fitup.updated_by = current_user.email
    except Exception:
        pass
    
    db.commit()
    db.refresh(fitup)
    try:
        joint = None
        if fitup.master_joint_id:
            joint = db.query(StructureMasterJointList).filter(StructureMasterJointList.id == fitup.master_joint_id).first()
        if not joint:
            joint = db.query(StructureMasterJointList).filter(
                StructureMasterJointList.project_id == fitup.project_id,
                StructureMasterJointList.draw_no == (fitup.draw_no or ""),
                StructureMasterJointList.structure_category == (fitup.structure_category or ""),
                StructureMasterJointList.page_no == (fitup.page_no or ""),
                StructureMasterJointList.drawing_rev == (fitup.drawing_rev or ""),
                StructureMasterJointList.joint_no == (fitup.joint_no or "")
            ).first()
        if joint:
            if fitup.fit_up_report_no:
                joint.fit_up_report_no = fitup.fit_up_report_no
            if (fitup.fit_up_result or '').lower() == 'accepted' and fitup.fit_up_report_no:
                joint.fitup_status = fitup.fit_up_report_no
            db.commit()
    except Exception:
        pass
    return fitup

@router.delete("/structure/fitup-inspection/{fitup_id}")
def delete_structure_fitup_inspection(
    fitup_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_admin)
):
    fitup = db.query(StructureFitUpInspection).filter(StructureFitUpInspection.id == fitup_id).first()
    if not fitup:
        raise HTTPException(status_code=404, detail="Structure fit-up inspection not found")
    
    # Check project access
    project = db.query(ProjectModel).filter(ProjectModel.id == fitup.project_id).first()
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    
    before = _audit_snapshot(fitup)
    db.delete(fitup)
    db.commit()
    try:
        _audit("structure_fitup", "delete", current_user, before=before, after=None, record_id=fitup.id, project_id=fitup.project_id)
    except Exception:
        pass
    return {"message": "Structure fit-up inspection deleted successfully"}

@router.post("/structure/fitup-inspection/sync-materials")
def sync_structure_fitup_materials(
    project_id: int = Query(..., description="Project ID to sync records for"),
    fitup_ids: Optional[List[int]] = Body(None, description="Optional list of fitup IDs to sync. If None, syncs all for project."),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")

    query = db.query(StructureFitUpInspection).filter(StructureFitUpInspection.project_id == project_id)
    if fitup_ids:
        query = query.filter(StructureFitUpInspection.id.in_(fitup_ids))
    
    records = query.all()
    updated_count = 0
    
    # Helper to lookup material
    # Cache materials to avoid repeated queries if many records have same piece mark
    material_cache = {}
    
    def get_material(piece_mark):
        if not piece_mark: return None
        pm_clean = piece_mark.strip()
        if not pm_clean: return None
        
        if pm_clean in material_cache: return material_cache[pm_clean]
        
        mat = db.query(StructureMaterialRegister).filter(
            StructureMaterialRegister.project_id == project_id,
            StructureMaterialRegister.piece_mark_no == pm_clean
        ).first()
        if mat:
            material_cache[pm_clean] = mat
        return mat

    for rec in records:
        changed = False
        # Part 1
        if rec.part1_piece_mark_no:
            mat = get_material(rec.part1_piece_mark_no)
            if mat:
                if rec.part1_material_type != mat.material_type: rec.part1_material_type = mat.material_type; changed = True
                if rec.part1_grade != mat.grade: rec.part1_grade = mat.grade; changed = True
                if rec.part1_thickness != mat.thickness: rec.part1_thickness = mat.thickness; changed = True
                if rec.part1_heat_no != mat.heat_no: rec.part1_heat_no = mat.heat_no; changed = True
        
        # Part 2
        if rec.part2_piece_mark_no:
            mat = get_material(rec.part2_piece_mark_no)
            if mat:
                if rec.part2_material_type != mat.material_type: rec.part2_material_type = mat.material_type; changed = True
                if rec.part2_grade != mat.grade: rec.part2_grade = mat.grade; changed = True
                if rec.part2_thickness != mat.thickness: rec.part2_thickness = mat.thickness; changed = True
                if rec.part2_heat_no != mat.heat_no: rec.part2_heat_no = mat.heat_no; changed = True
        
        if changed:
            updated_count += 1
            # Update updated_by/at if desired, or leave as silent sync
            
    if updated_count > 0:
        db.commit()
        
    return {"message": f"Synced {updated_count} records", "updated_count": updated_count}

# Structure Final Inspection Routes
@router.get("/structure/final-inspection", response_model=List[StructureFinalInspectionSchema])
def get_structure_final_inspections(
    skip: int = 0,
    limit: int = 20000,
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    query = db.query(StructureFinalInspection).options(joinedload(StructureFinalInspection.fitup))
    
    if project_id:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        if current_user.role != 'admin' and project not in current_user.assigned_projects:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
        query = query.filter(StructureFinalInspection.project_id == project_id)
    else:
        if current_user.role != 'admin':
            user_project_ids = [p.id for p in current_user.assigned_projects]
            query = query.filter(StructureFinalInspection.project_id.in_(user_project_ids))
    
    final_inspections = query.offset(skip).limit(limit).all()
    
    # Add joint information from fit-up records
    for final_inspection in final_inspections:
        if final_inspection.fitup:
            final_inspection.draw_no = final_inspection.fitup.draw_no
            final_inspection.structure_category = final_inspection.fitup.structure_category
            final_inspection.page_no = final_inspection.fitup.page_no
            # Note: StructureFinalInspection doesn't have drawing_rev column
            final_inspection.drawing_rev = final_inspection.fitup.drawing_rev
            final_inspection.joint_no = final_inspection.fitup.joint_no
    
    return final_inspections

@router.get("/structure/final-inspection/filters")
def get_structure_final_filters(
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    query = db.query(StructureFinalInspection)
    if project_id:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        if current_user.role != 'admin' and project not in current_user.assigned_projects:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
        query = query.filter(StructureFinalInspection.project_id == project_id)
    else:
        if current_user.role != 'admin':
            user_project_ids = [p.id for p in current_user.assigned_projects]
            query = query.filter(StructureFinalInspection.project_id.in_(user_project_ids))

    rows = query.all()
    def uniq(vals):
        return sorted([v for v in set([str(x).strip() for x in vals if x]) if v])

    # Get drawing_rev from related fitup records
    drawing_revs = []
    structure_categories = []
    joint_nos = []
    final_report_nos = []
    final_results = []
    draw_nos = []
    
    for r in rows:
        # Get structure_category from final inspection
        if r.structure_category:
            structure_categories.append(r.structure_category)
            
        # Get draw_no from final inspection
        if r.draw_no:
            draw_nos.append(r.draw_no)
        
        # Get joint_no from final inspection
        if r.joint_no:
            joint_nos.append(r.joint_no)
        
        # Get final_report_no from final inspection
        if r.final_report_no:
            final_report_nos.append(r.final_report_no)
        
        # Get final_result from final inspection
        if r.final_result:
            final_results.append(r.final_result)
        
        # Get drawing_rev from related fitup records
        if r.fitup_id:
            fitup = db.query(StructureFitUpInspection).filter(StructureFitUpInspection.id == r.fitup_id).first()
            if fitup and fitup.drawing_rev:
                drawing_revs.append(fitup.drawing_rev)
    
    return {
        "structure_category": uniq(structure_categories),
        "draw_no": uniq(draw_nos),
        "drawing_rev": uniq(drawing_revs),
        "joint_no": uniq(joint_nos),
        "final_report_no": uniq(final_report_nos),
        "final_result": uniq(final_results)
    }

@router.post("/structure/final-inspection", response_model=StructureFinalInspectionSchema)
def create_structure_final_inspection(
    final: StructureFinalInspectionCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == final.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Verify fitup exists if fitup_id is provided
    if final.fitup_id:
        fitup = db.query(StructureFitUpInspection).filter(StructureFitUpInspection.id == final.fitup_id).first()
        if not fitup:
            raise HTTPException(status_code=404, detail="Structure fit-up inspection not found")
        if fitup.project_id != final.project_id:
            raise HTTPException(status_code=400, detail="Fit-up and Final must belong to the same project")
        
        # Inherit Block No from Fit-up
        if not final.block_no and fitup.block_no:
            final.block_no = fitup.block_no
            
    # Auto-lookup from Master Joint List based on Block No + Joint No
    if final.block_no and final.joint_no:
        master_joint = db.query(StructureMasterJointList).filter(
            StructureMasterJointList.project_id == final.project_id,
            StructureMasterJointList.block_no == final.block_no,
            StructureMasterJointList.joint_no == final.joint_no
        ).first()
        
        if master_joint:
            final.draw_no = master_joint.draw_no
            final.structure_category = master_joint.structure_category
            final.page_no = master_joint.page_no
            # Also inherit drawing_rev if available, though not explicitly requested, it usually goes with drawing info
            # Note: StructureFinalInspection doesn't have drawing_rev column, so we don't set it
            # if hasattr(master_joint, 'drawing_rev') and not final.drawing_rev:
            #     final.drawing_rev = master_joint.drawing_rev

    data = final.model_dump()
    # Remove drawing_rev if present, as it's not in the model
    if 'drawing_rev' in data:
        data.pop('drawing_rev')
        
    if not data.get('welder_validity') and data.get('welder_no'):
        w = db.query(WelderRegister).filter(WelderRegister.project_id == final.project_id, WelderRegister.welder_no == data.get('welder_no')).first()
        if w and getattr(w, 'validity', None):
            data['welder_validity'] = w.validity
    
    # Auto-lookup thickness from fit-up records based on draw_no and joint_no
    
    db_final = StructureFinalInspection(**data)
    db.add(db_final)
    db.commit()
    db.refresh(db_final)
    # Create persistent NDT status record for this final
    existing = db.query(StructureNDTStatusRecord).filter(StructureNDTStatusRecord.final_id == db_final.id).first()
    if not existing:
        fitup = None
        if db_final.fitup_id:
            fitup = db.query(StructureFitUpInspection).filter(StructureFitUpInspection.id == db_final.fitup_id).first()
            
        m = getattr(db_final, 'ndt_type', None)
        parts = [p.strip() for p in re.split(r"[,;/\s]+", m or "") if p.strip()]
        
        # Safely get attributes from fitup if it exists
        def get_fitup_attr(attr, default=None):
            return getattr(fitup, attr, default) if fitup else default

        # Try to get thickness from master joint if available
        thickness_val = None
        if fitup and fitup.master_joint:
             thickness_val = fitup.master_joint.thickness
        
        # If not in master joint, try to get from fitup parts (use part1 as default or max?)
        if not thickness_val and fitup:
             thickness_val = fitup.part1_thickness or fitup.part2_thickness

        rec = StructureNDTStatusRecord(
            project_id=db_final.project_id,
            final_id=db_final.id,
            draw_no=(get_fitup_attr('draw_no') or getattr(db_final, 'draw_no', None)),
            structure_category=(get_fitup_attr('structure_category') or getattr(db_final, 'structure_category', None)),
            page_no=(get_fitup_attr('page_no') or getattr(db_final, 'page_no', None)),
            drawing_rev=(get_fitup_attr('drawing_rev') or getattr(db_final, 'drawing_rev', None)),
            joint_no=(get_fitup_attr('joint_no') or getattr(db_final, 'joint_no', None)),
            weld_type=(get_fitup_attr('weld_type') or getattr(db_final, 'weld_type', None)),
            welder_no=db_final.welder_no,
            weld_length=db_final.weld_length,
            rejected_length=0.0,
            weld_site=get_fitup_attr('weld_site'),
            thickness=thickness_val,
            ndt_type=(parts[0] if len(parts) == 1 else None),
        )
        db.add(rec)
        db.commit()
    try:
        joint = None
        # Priority 1: Find via Fitup -> MasterJoint relation
        if db_final.fitup_id:
            fitup = db.query(StructureFitUpInspection).filter(StructureFitUpInspection.id == db_final.fitup_id).first()
            if fitup and fitup.master_joint_id:
                joint = db.query(StructureMasterJointList).filter(StructureMasterJointList.id == fitup.master_joint_id).first()
        
        # Priority 2: Find via Block No + Joint No (Fallback)
        if not joint:
            joint = db.query(StructureMasterJointList).filter(
                StructureMasterJointList.project_id == db_final.project_id,
                StructureMasterJointList.block_no == (db_final.block_no or ""),
                StructureMasterJointList.joint_no == (db_final.joint_no or ""),
            ).first()
        
        if joint and (db_final.final_result or '').lower() == 'accepted' and db_final.final_report_no:
            joint.final_report_no = db_final.final_report_no
            joint.final_status = 'accepted'
            db.commit()
    except Exception:
        pass
    return db_final

@router.put("/structure/final-inspection/bulk-update")
def bulk_update_final_inspections(
    final_ids: List[int] = Body(..., description="List of final inspection IDs to update"),
    update_data: dict = Body(..., description="Fields to update for all selected finals"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    """
    Bulk update multiple final inspections with the same field values.
    Only updates specified fields: welder_no, wps_no, final_report_no, final_date, ndt_type, final_result
    """
    if not final_ids:
        raise HTTPException(status_code=400, detail="No final inspection IDs provided")
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    # Only allow specific fields to be updated in bulk
    allowed_fields = {'welder_no', 'wps_no', 'final_report_no', 'final_date', 'ndt_type', 'final_result'}
    update_fields = {k: v for k, v in update_data.items() if k in allowed_fields}
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No valid fields to update. Allowed fields: welder_no, wps_no, final_report_no, final_date, ndt_type, final_result")
    
    updated_count = 0
    errors = []
    
    for final_id in final_ids:
        try:
            # Get final inspection
            final = db.query(StructureFinalInspection).filter(StructureFinalInspection.id == final_id).first()
            if not final:
                errors.append(f"Final ID {final_id}: Not found")
                continue
            
            # Check project access
            project = db.query(ProjectModel).filter(ProjectModel.id == final.project_id).first()
            if current_user.role != 'admin' and project not in current_user.assigned_projects:
                errors.append(f"Final ID {final_id}: Not authorized to access this project")
                continue
            
            # Check if inspector is trying to edit accepted final
            if (current_user.role or '').lower() == 'inspector':
                s = (final.final_result or '').lower()
                if s == 'accepted':
                    errors.append(f"Final ID {final_id}: Not authorized to edit accepted final as inspector")
                    continue
            
            # Apply updates
            for field, value in update_fields.items():
                if field == 'final_date' and value:
                    try:
                        if isinstance(value, str):
                            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
                    except Exception:
                        value = None
                
                setattr(final, field, value)
            
            # Auto-fill welder_validity if welder_no changed
            if 'welder_no' in update_fields and update_fields['welder_no'] and not final.welder_validity:
                w = db.query(WelderRegister).filter(
                    WelderRegister.project_id == final.project_id,
                    WelderRegister.welder_no == update_fields['welder_no']
                ).first()
                if w and getattr(w, 'validity', None):
                    final.welder_validity = w.validity
            
            db.commit()
            updated_count += 1
            
            # Auto-sync to Master Joint List
            try:
                joint = None
                # Priority 1: Find via Fitup -> MasterJoint relation
                if final.fitup_id:
                    fitup = db.query(StructureFitUpInspection).filter(StructureFitUpInspection.id == final.fitup_id).first()
                    if fitup and fitup.master_joint_id:
                        joint = db.query(StructureMasterJointList).filter(StructureMasterJointList.id == fitup.master_joint_id).first()
                
                # Priority 2: Find via Block No + Joint No (Fallback)
                if not joint:
                    joint = db.query(StructureMasterJointList).filter(
                        StructureMasterJointList.project_id == final.project_id,
                        StructureMasterJointList.block_no == (final.block_no or ""),
                        StructureMasterJointList.joint_no == (final.joint_no or ""),
                    ).first()
                
                if joint and (final.final_result or '').lower() == 'accepted' and final.final_report_no:
                    joint.final_report_no = final.final_report_no
                    joint.final_status = 'accepted'
                    db.commit()
            except Exception:
                pass
            
        except Exception as e:
            db.rollback()
            errors.append(f"Final ID {final_id}: {str(e)}")
    
    return {
        "message": f"Updated {updated_count} final inspections",
        "updated_count": updated_count,
        "errors": errors if errors else None
    }


@router.put("/structure/final-inspection/{final_id}", response_model=StructureFinalInspectionSchema)
def update_structure_final_inspection(
    final_id: int,
    final_update: dict,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    final = db.query(StructureFinalInspection).filter(StructureFinalInspection.id == final_id).first()
    if not final:
        raise HTTPException(status_code=404, detail="Structure final inspection not found")
    
    # Check project access
    project = db.query(ProjectModel).filter(ProjectModel.id == final.project_id).first()
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    
    if (current_user.role or '').lower() == 'inspector':
        s = (final.final_result or '').lower()
        if s == 'accepted':
            raise HTTPException(status_code=403, detail="Not authorized to edit accepted final as inspector")
    
    update_data = final_update if isinstance(final_update, dict) else final_update.model_dump(exclude_unset=True)
    immutable = {'id', 'project_id', 'created_at', 'drawing_rev'}
    for k in list(update_data.keys()):
        if k in immutable:
            update_data.pop(k, None)
    
    # Normalize fitup_id: ignore falsy values like 0 or empty string
    if "fitup_id" in update_data and (not update_data["fitup_id"]):
        update_data.pop("fitup_id")
    
    # Handle datetime conversion for final_date
    if "final_date" in update_data and update_data["final_date"]:
        try:
            val = update_data["final_date"]
            if isinstance(val, str):
                update_data["final_date"] = datetime.fromisoformat(val.replace("Z", "+00:00"))
        except Exception:
            update_data["final_date"] = None
    
    # Verify fitup exists if fitup_id is being updated and not null
    if "fitup_id" in update_data and update_data["fitup_id"] is not None:
        fitup = db.query(StructureFitUpInspection).filter(StructureFitUpInspection.id == update_data["fitup_id"]).first()
        if not fitup:
            raise HTTPException(status_code=404, detail="Structure fit-up inspection not found")
        if fitup.project_id != final.project_id:
            raise HTTPException(status_code=400, detail="Fit-up and Final must belong to the same project")
    
    # Auto-fill welder_validity if welder_no changed and validity missing
    if (not update_data.get('welder_validity')) and update_data.get('welder_no'):
        w = db.query(WelderRegister).filter(WelderRegister.project_id == final.project_id, WelderRegister.welder_no == update_data.get('welder_no')).first()
        if w and getattr(w, 'validity', None):
            update_data['welder_validity'] = w.validity
    
    # Auto-lookup thickness from fit-up records if draw_no or joint_no are being updated
    for field, value in update_data.items():
        setattr(final, field, value)
    
    db.commit()
    db.refresh(final)
    try:
        joint = None
        # Priority 1: Find via Fitup -> MasterJoint relation
        if final.fitup_id:
            fitup = db.query(StructureFitUpInspection).filter(StructureFitUpInspection.id == final.fitup_id).first()
            if fitup and fitup.master_joint_id:
                joint = db.query(StructureMasterJointList).filter(StructureMasterJointList.id == fitup.master_joint_id).first()
        
        # Priority 2: Find via Block No + Joint No (Fallback)
        if not joint:
            joint = db.query(StructureMasterJointList).filter(
                StructureMasterJointList.project_id == final.project_id,
                StructureMasterJointList.block_no == (final.block_no or ""),
                StructureMasterJointList.joint_no == (final.joint_no or ""),
            ).first()
        
        if joint and (final.final_result or '').lower() == 'accepted' and final.final_report_no:
            joint.final_report_no = final.final_report_no
            joint.final_status = 'accepted'
            db.commit()
    except Exception:
        pass
    return final

@router.delete("/structure/final-inspection/{final_id}")
def delete_structure_final_inspection(
    final_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_admin)
):
    final = db.query(StructureFinalInspection).filter(StructureFinalInspection.id == final_id).first()
    if not final:
        raise HTTPException(status_code=404, detail="Structure final inspection not found")
    
    # Check project access
    project = db.query(ProjectModel).filter(ProjectModel.id == final.project_id).first()
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    
    # Cascade delete dependent records referencing this final
    db.query(StructureNDTStatusRecord).filter(StructureNDTStatusRecord.final_id == final.id).delete(synchronize_session=False)
    db.query(StructureNDTRequest).filter(StructureNDTRequest.final_id == final.id).delete(synchronize_session=False)
    db.query(NDTTest).filter(NDTTest.final_id == final.id).delete(synchronize_session=False)

    before = _audit_snapshot(final)
    db.delete(final)
    db.commit()
    try:
        _audit("structure_final", "delete", current_user, before=before, after=None, record_id=final.id, project_id=final.project_id)
    except Exception:
        pass
    return {"message": "Structure final inspection deleted successfully"}

# Structure NDT Request Routes
@router.get("/structure/ndt-requests", response_model=List[StructureNDTRequestSchema])
def get_structure_ndt_requests(
    skip: int = 0,
    limit: int = 100,
    project_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    query = db.query(StructureNDTRequest)
    
    if project_id:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        if current_user.role != 'admin' and project not in current_user.assigned_projects:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
        query = query.filter(StructureNDTRequest.project_id == project_id)
    else:
        if current_user.role != 'admin':
            user_project_ids = [p.id for p in current_user.assigned_projects]
            query = query.filter(StructureNDTRequest.project_id.in_(user_project_ids))
    
    if status:
        query = query.filter(StructureNDTRequest.status == status)
    
    return query.offset(skip).limit(limit).all()

@router.post("/structure/ndt-requests", response_model=StructureNDTRequestSchema)
def create_structure_ndt_request(
    ndt: StructureNDTRequestCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == ndt.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Validate that final_id is provided and the final inspection exists and is accepted
    if not ndt.final_id:
        raise HTTPException(status_code=400, detail="final_id is required to link NDT request to a final inspection")
    
    final = db.query(StructureFinalInspection).filter(StructureFinalInspection.id == ndt.final_id).first()
    if not final:
        raise HTTPException(status_code=404, detail="Structure final inspection not found")
    
    # Check if final inspection is accepted (case-insensitive)
    if (final.final_result or "").lower() != "accepted":
        raise HTTPException(status_code=400, detail="Only joints with accepted final inspection can be requested for NDT")
    
    # Auto-populate project details
    if not ndt.project_name:
        ndt.project_name = project.name
    if not ndt.project_code:
        ndt.project_code = project.code
    
    # Get fitup details to inherit joint information
    fitup = db.query(StructureFitUpInspection).filter(StructureFitUpInspection.id == final.fitup_id).first()
    if fitup:
        ndt.draw_no = fitup.draw_no
        ndt.structure_category = fitup.structure_category
        ndt.page_no = fitup.page_no
        ndt.drawing_rev = fitup.drawing_rev
        ndt.joint_no = fitup.joint_no
        ndt.weld_type = fitup.weld_type
        if hasattr(fitup, 'weld_process'):
            ndt.weld_process = fitup.weld_process
        
        # Get thickness from master joint if available, otherwise from fitup parts
        thickness_val = None
        if fitup.master_joint:
            thickness_val = fitup.master_joint.thickness
        if not thickness_val:
            thickness_val = fitup.part1_thickness or fitup.part2_thickness
        
        ndt.thickness = thickness_val
        ndt.block_no = getattr(fitup, 'block_no', None)
    else:
        ndt.draw_no = getattr(final, 'draw_no', ndt.draw_no)
        ndt.structure_category = getattr(final, 'structure_category', ndt.structure_category)
        ndt.page_no = getattr(final, 'page_no', ndt.page_no)
        ndt.drawing_rev = getattr(final, 'drawing_rev', ndt.drawing_rev)
        ndt.joint_no = getattr(final, 'joint_no', ndt.joint_no)
        ndt.weld_type = getattr(final, 'weld_type', ndt.weld_type)
        ndt.thickness = getattr(final, 'thickness', getattr(ndt, 'thickness', None))
        ndt.block_no = getattr(final, 'block_no', getattr(ndt, 'block_no', None))
    
    # If structure category, draw_no, or weld_length are still missing, try to get from master joint list
    if (not ndt.structure_category or not ndt.draw_no or not ndt.weld_size) and ndt.block_no and ndt.joint_no:
        master_joint = db.query(StructureMasterJointList).filter(
            StructureMasterJointList.project_id == ndt.project_id,
            StructureMasterJointList.block_no == ndt.block_no,
            StructureMasterJointList.joint_no == ndt.joint_no
        ).first()
        
        if master_joint:
            if not ndt.structure_category:
                ndt.structure_category = master_joint.structure_category
            if not ndt.draw_no:
                ndt.draw_no = master_joint.draw_no
            if not ndt.weld_size and master_joint.weld_length:
                ndt.weld_size = master_joint.weld_length
            if not ndt.page_no:
                ndt.page_no = master_joint.page_no
            if not ndt.drawing_rev:
                ndt.drawing_rev = master_joint.drawing_rev
    
    ndt.welder_no = final.welder_no
    ndt.weld_size = ndt.weld_size or final.weld_length
    
    # Auto-inherit inspection category from final inspection
    ndt.inspection_category = final.inspection_category or 'type-I'
    
    # Duplication guard by composite key
    existing_dup = db.query(StructureNDTRequest).filter(
        StructureNDTRequest.project_id == ndt.project_id,
        StructureNDTRequest.draw_no == ndt.draw_no,
        StructureNDTRequest.structure_category == ndt.structure_category,
        StructureNDTRequest.page_no == ndt.page_no,
        StructureNDTRequest.drawing_rev == ndt.drawing_rev,
        StructureNDTRequest.joint_no == ndt.joint_no,
        StructureNDTRequest.ndt_type == ndt.ndt_type,
    ).first()
    if existing_dup:
        raise HTTPException(status_code=400, detail="Duplicate NDT request for joint and method")

    ndt_data = ndt.model_dump()
    # Remove fields not in model
    if 'test_length' in ndt_data:
        del ndt_data['test_length']

    db_ndt = StructureNDTRequest(**ndt_data)
    db.add(db_ndt)
    db.commit()
    db.refresh(db_ndt)

    # Synchronize to NDT Status Page
    try:
        # Check for existing record with same final_id AND ndt_type
        method = ndt.ndt_type
        rec = db.query(StructureNDTStatusRecord).filter(
            StructureNDTStatusRecord.final_id == ndt.final_id,
            StructureNDTStatusRecord.ndt_type == method
        ).first()
        
        # Determine NDT result based on status (initially 'pending')
        result = "pending"
        
        if not rec:
            # Create new status record if it doesn't exist
            fitup = db.query(StructureFitUpInspection).filter(StructureFitUpInspection.id == final.fitup_id).first()
            
            # Ensure structure_category is available
            struct_cat = getattr(fitup, 'structure_category', None) or getattr(final, 'structure_category', None) or ndt.structure_category
            if not struct_cat:
                 # Try one last lookup from Master Joint if not found
                 mj = db.query(StructureMasterJointList).filter(
                     StructureMasterJointList.project_id == final.project_id,
                     StructureMasterJointList.block_no == (getattr(fitup, 'block_no', None) or getattr(final, 'block_no', None) or ndt.block_no),
                     StructureMasterJointList.joint_no == (getattr(fitup, 'joint_no', None) or getattr(final, 'joint_no', None) or ndt.joint_no)
                 ).first()
                 if mj:
                     struct_cat = mj.structure_category
            
            rec = StructureNDTStatusRecord(
                project_id=final.project_id,
                final_id=final.id,
                draw_no=(getattr(fitup, 'draw_no', None) or getattr(final, 'draw_no', None) or ndt.draw_no),
                structure_category=struct_cat,
                page_no=(getattr(fitup, 'page_no', None) or getattr(final, 'page_no', None) or ndt.page_no),
                drawing_rev=(getattr(fitup, 'drawing_rev', None) or getattr(final, 'drawing_rev', None) or ndt.drawing_rev),
                joint_no=(getattr(fitup, 'joint_no', None) or getattr(final, 'joint_no', None) or ndt.joint_no),
                weld_type=(getattr(fitup, 'weld_type', None) or getattr(final, 'weld_type', None) or ndt.weld_type),
                welder_no=final.welder_no,
                weld_length=ndt.weld_size or final.weld_length,
                rejected_length=0.0,
                weld_site=getattr(fitup, 'weld_site', None),
                thickness=ndt.thickness,
                block_no=(getattr(fitup, 'block_no', None) or getattr(final, 'block_no', None) or ndt.block_no),
                ndt_type=(method or None),
                ndt_result=result
            )
            db.add(rec)
        else:
            # Update existing record
            if method:
                rec.ndt_type = method
            rec.ndt_result = result
            rec.weld_length = ndt.weld_size
            if getattr(ndt, 'welder_no', None):
                rec.welder_no = ndt.welder_no
            # Update block_no if missing
            if not rec.block_no and ndt.block_no:
                rec.block_no = ndt.block_no
        
        db.commit()
        db.refresh(rec)

        # Also update NDTTest table
        if method:
            test = db.query(NDTTest).filter(NDTTest.final_id == ndt.final_id, NDTTest.method == method).first()
            if not test:
                test = NDTTest(
                    project_id=ndt.project_id,
                    final_id=ndt.final_id,
                    project_type="structure",
                    method=method,
                    result=result,
                    test_length=ndt.weld_size,
                )
                db.add(test)
            else:
                test.result = result
                test.test_length = ndt.weld_size
        db.commit()

    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error syncing NDT status: {e}")
        # Re-raise the exception so the user knows it failed, or at least log it visibly
        # If we raise here, the NDT Request creation (db_ndt) is already committed above.
        # So the request exists, but status failed. 
        # We should probably let the user know, but returning 500 now would confuse them 
        # (request created but error returned).
        # Better to log and maybe add a warning to response? 
        # For now, printing traceback is better than silent pass.
        pass

    return db_ndt

@router.put("/structure/ndt-requests/{ndt_id}/status")
def update_structure_ndt_status(
    ndt_id: int,
    status_update: dict,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    ndt = db.query(StructureNDTRequest).filter(StructureNDTRequest.id == ndt_id).first()
    if not ndt:
        raise HTTPException(status_code=404, detail="Structure NDT request not found")
    
    # Check project access
    project = db.query(ProjectModel).filter(ProjectModel.id == ndt.project_id).first()
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    
    new_status = status_update.get("status")
    # Allow "RFI Raised" as a valid status
    if new_status not in ["pending", "RFI Raised"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    ndt.status = new_status
    # Only set ndt_result for approved/rejected statuses
    if new_status == "pending":
        ndt.ndt_result = "pending"
    elif new_status == "RFI Raised":
        ndt.ndt_result = "pending"
    
    db.commit()

    # Synchronize status/test when marking approved/rejected or RFI Raised
    try:
        if new_status in ("pending","RFI Raised") and ndt.final_id:
            rec = db.query(StructureNDTStatusRecord).filter(StructureNDTStatusRecord.final_id == ndt.final_id).first()
            final = db.query(StructureFinalInspection).filter(StructureFinalInspection.id == ndt.final_id).first()
            method = ndt.ndt_type
            
            # Set result based on status
            result = None
            if new_status == "RFI Raised":
                result = "pending"
            elif new_status == "pending":
                result = "pending"
            
            report_no = getattr(ndt, 'ndt_report_no', None) or getattr(rec, 'ndt_report_no', None)
            
            if not rec and final and (getattr(final, 'final_result', '') or '').lower() == 'accepted':
                fitup = db.query(StructureFitUpInspection).filter(StructureFitUpInspection.id == final.fitup_id).first()
                rec = StructureNDTStatusRecord(
                    project_id=final.project_id,
                    final_id=final.id,
                    structure_category=(getattr(fitup, 'structure_category', None) or getattr(final, 'structure_category', None)),
                    page_no=(getattr(fitup, 'page_no', None) or getattr(final, 'page_no', None)),
                    drawing_rev=(getattr(fitup, 'drawing_rev', None) or getattr(final, 'drawing_rev', None)),
                    joint_no=(getattr(fitup, 'joint_no', None) or getattr(final, 'joint_no', None)),
                    weld_type=(getattr(fitup, 'weld_type', None) or getattr(final, 'weld_type', None)),
                    welder_no=final.welder_no,
                    weld_length=ndt.weld_size or final.weld_length,
                    rejected_length=0.0,
                    weld_site=getattr(fitup, 'weld_site', None),
                    thickness=ndt.thickness,
                    ndt_type=(method or None),
                )
                db.add(rec)
                db.commit()
                db.refresh(rec)

            if rec:
                if method:
                    rec.ndt_type = method
                if report_no is not None:
                    rec.ndt_report_no = report_no
                if result:
                    rec.ndt_result = result
                rec.weld_length = ndt.weld_size
                if getattr(ndt, 'welder_no', None):
                    rec.welder_no = ndt.welder_no
            
            if method:
                test = db.query(NDTTest).filter(NDTTest.final_id == ndt.final_id, NDTTest.method == method).first()
                if not test:
                    test = NDTTest(
                        project_id=ndt.project_id,
                        final_id=ndt.final_id,
                        project_type="structure",
                        method=method,
                        result=result,
                        report_no=report_no,
                        test_length=ndt.weld_size,
                    )
                    db.add(test)
                else:
                    if result:  # Only update result if we have a value
                        test.result = result
                    if report_no is not None:
                        test.report_no = report_no
                    test.test_length = ndt.weld_size
            db.commit()
    except Exception:
        pass
    
    return {"message": f"Structure NDT request status updated to {new_status}"}

@router.put("/structure/ndt-requests/{ndt_id}", response_model=StructureNDTRequestSchema)
def update_structure_ndt_request(
    ndt_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    ndt = db.query(StructureNDTRequest).filter(StructureNDTRequest.id == ndt_id).first()
    if not ndt:
        raise HTTPException(status_code=404, detail="Structure NDT request not found")
    project = db.query(ProjectModel).filter(ProjectModel.id == ndt.project_id).first()
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")

    before = _audit_snapshot(ndt)
    update_data = payload if isinstance(payload, dict) else payload.model_dump(exclude_unset=True)
    immutable = {'id', 'project_id', 'created_at'}
    for k in list(update_data.keys()):
        if k in immutable:
            update_data.pop(k, None)
    # Normalize datetime strings for request_time and test_time
    for dt_field in ("request_time", "test_time"):
        if dt_field in update_data and update_data[dt_field]:
            try:
                val = update_data[dt_field]
                if isinstance(val, str):
                    update_data[dt_field] = datetime.fromisoformat(val.replace("Z", "+00:00"))
            except Exception:
                update_data[dt_field] = None
    # Only re-inherit joint details when linking to a different final_id
    if 'final_id' in update_data and update_data['final_id'] and update_data['final_id'] != ndt.final_id:
        final = db.query(StructureFinalInspection).filter(StructureFinalInspection.id == update_data['final_id']).first()
        if not final:
            raise HTTPException(status_code=404, detail="Structure final inspection not found")
        if final.project_id != ndt.project_id:
            raise HTTPException(status_code=400, detail="Final and NDT request must belong to the same project")
        if (final.final_result or '').lower() != 'accepted':
            raise HTTPException(status_code=400, detail="Only accepted final inspections can be linked")
        fitup = db.query(StructureFitUpInspection).filter(StructureFitUpInspection.id == final.fitup_id).first()
        if fitup:
            ndt.draw_no = getattr(fitup, 'draw_no', ndt.draw_no)
            ndt.structure_category = getattr(fitup, 'structure_category', ndt.structure_category)
            ndt.page_no = getattr(fitup, 'page_no', ndt.page_no)
            ndt.drawing_rev = getattr(fitup, 'drawing_rev', ndt.drawing_rev)
            ndt.joint_no = getattr(fitup, 'joint_no', ndt.joint_no)
            ndt.weld_type = getattr(fitup, 'weld_type', ndt.weld_type)
            ndt.weld_process = getattr(fitup, 'weld_process', ndt.weld_process)
        ndt.welder_no = getattr(final, 'welder_no', ndt.welder_no)
        ndt.weld_size = getattr(final, 'weld_length', ndt.weld_size)
        ndt.inspection_category = getattr(final, 'inspection_category', ndt.inspection_category) or 'type-I'

    before = _audit_snapshot(ndt)
    immutable = {'id', 'project_id', 'created_at'}
    for k, v in update_data.items():
        if k in immutable:
            continue
        setattr(ndt, k, v)
    # If result/report provided, synchronize status record and test
    try:
        method = update_data.get('ndt_type') or ndt.ndt_type
        result = update_data.get('ndt_result')
        if isinstance(result, str):
            rvl = result.strip().lower()
            result = rvl if rvl in ('accepted', 'rejected') else None
        report_no = update_data.get('ndt_report_no') or update_data.get('report_no')
        if ndt.final_id and result in ('accepted', 'rejected'):
            rec = db.query(StructureNDTStatusRecord).filter(StructureNDTStatusRecord.final_id == ndt.final_id).first()
            if rec:
                if method:
                    rec.ndt_type = method
                if report_no is not None:
                    rec.ndt_report_no = report_no
                rec.ndt_result = result
                rec.weld_length = ndt.weld_size
            # upsert NDTTest for (final_id, method)
            if method:
                test = db.query(NDTTest).filter(NDTTest.final_id == ndt.final_id, NDTTest.method == method).first()
                if not test:
                    test = NDTTest(
                        project_id=ndt.project_id,
                        final_id=ndt.final_id,
                        project_type="structure",
                        method=method,
                        result=result,
                        report_no=report_no,
                        test_length=ndt.weld_size,
                    )
                    db.add(test)
                else:
                    test.result = result
                    if report_no is not None:
                        test.report_no = report_no
                    test.test_length = ndt.weld_size
    except Exception:
        pass
    db.commit()
    db.refresh(ndt)
    return ndt

@router.delete("/structure/ndt-requests/{ndt_id}")
def delete_structure_ndt_request(
    ndt_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_admin)
):
    ndt = db.query(StructureNDTRequest).filter(StructureNDTRequest.id == ndt_id).first()
    if not ndt:
        raise HTTPException(status_code=404, detail="Structure NDT request not found")
    project = db.query(ProjectModel).filter(ProjectModel.id == ndt.project_id).first()
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    before = _audit_snapshot(ndt)
    db.delete(ndt)
    db.commit()
    try:
        _audit("structure_ndt_request", "delete", current_user, before=before, after=None, record_id=ndt.id, project_id=ndt.project_id)
    except Exception:
        pass
    return {"message": "Structure NDT request deleted"}

# Structure NDT Tests Routes (shared with pipe projects)
@router.get("/structure/ndt-tests", response_model=List[NDTTestSchema])
def get_structure_ndt_tests(
    skip: int = 0,
    limit: int = 100,
    project_id: Optional[int] = Query(None),
    final_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    query = db.query(NDTTest)
    if project_id:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        if current_user.role != 'admin' and project not in current_user.assigned_projects:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
        query = query.filter(NDTTest.project_id == project_id)
    else:
        if current_user.role != 'admin':
            user_project_ids = [p.id for p in current_user.assigned_projects]
            query = query.filter(NDTTest.project_id.in_(user_project_ids))
    if final_id:
        query = query.filter(NDTTest.final_id == final_id)
    return query.offset(skip).limit(min(limit, 500)).all()

@router.post("/structure/ndt-tests", response_model=NDTTestSchema)
def create_structure_ndt_test(
    payload: NDTTestCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    final = db.query(StructureFinalInspection).filter(StructureFinalInspection.id == payload.final_id).first()
    if not final:
        raise HTTPException(status_code=404, detail="Structure final inspection not found")
    if final.project_id != payload.project_id:
        raise HTTPException(status_code=400, detail="Final and NDT test must belong to the same project")
    
    # Add project_type for structure projects
    ndt_data = payload.model_dump()
    ndt_data['project_type'] = "structure"
    
    ndt = NDTTest(**ndt_data)
    db.add(ndt)
    db.commit()
    db.refresh(ndt)
    return ndt

@router.put("/structure/ndt-tests/{test_id}", response_model=NDTTestSchema)
def update_structure_ndt_test(
    test_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    ndt = db.query(NDTTest).filter(NDTTest.id == test_id).first()
    if not ndt:
        raise HTTPException(status_code=404, detail="NDT test not found")
    project = db.query(ProjectModel).filter(ProjectModel.id == ndt.project_id).first()
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    
    update_data = payload if isinstance(payload, dict) else payload.model_dump(exclude_unset=True)
    
    # Handle datetime conversion for test_date field
    if "test_date" in update_data and update_data["test_date"]:
        try:
            val = update_data["test_date"]
            if isinstance(val, str):
                update_data["test_date"] = datetime.fromisoformat(val.replace("Z", "+00:00"))
        except Exception:
            update_data["test_date"] = None
    
    for k, v in update_data.items():
        setattr(ndt, k, v)
    
    db.commit()
    db.refresh(ndt)
    return ndt

@router.delete("/structure/ndt-tests/{test_id}")
def delete_structure_ndt_test(
    test_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_admin)
):
    ndt = db.query(NDTTest).filter(NDTTest.id == test_id).first()
    if not ndt:
        raise HTTPException(status_code=404, detail="NDT test not found")
    project = db.query(ProjectModel).filter(ProjectModel.id == ndt.project_id).first()
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    before = _audit_snapshot(ndt)
    db.delete(ndt)
    db.commit()
    try:
        _audit("ndt_test", "delete", current_user, before=before, after=None, record_id=ndt.id, project_id=ndt.project_id)
    except Exception:
        pass
    return {"message": "NDT test deleted successfully"}

# Structure NDT Status Routes
@router.get("/structure/ndt-status", response_model=List[StructureNDTStatusRecordSchema])
def get_structure_ndt_status(
    project_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Get NDT status for display in the NDT status table for structure projects.
    Only returns records where:
    1. Final inspection is accepted
    2. Corresponding NDT request exists
    3. Joint is valid (has all required joint identifiers)
    This ensures the NDT status table only shows valid joints.
    """
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    
    # Query NDT status records with joins to validate relationships
    q = db.query(StructureNDTStatusRecord).join(
        StructureFinalInspection, StructureFinalInspection.id == StructureNDTStatusRecord.final_id
    ).outerjoin(
        StructureNDTRequest,
        and_(
            StructureNDTRequest.project_id == StructureNDTStatusRecord.project_id,
            StructureNDTRequest.structure_category == StructureNDTStatusRecord.structure_category,
            StructureNDTRequest.page_no == StructureNDTStatusRecord.page_no,
            StructureNDTRequest.drawing_rev == StructureNDTStatusRecord.drawing_rev,
            StructureNDTRequest.joint_no == StructureNDTStatusRecord.joint_no,
            StructureNDTRequest.ndt_type == StructureNDTStatusRecord.ndt_type
        )
    )
    
    q = q.filter(StructureNDTStatusRecord.project_id == project_id)
    q = q.filter(StructureFinalInspection.final_result.isnot(None))
    q = q.filter(StructureFinalInspection.final_result.ilike('accepted'))
    q = q.filter(StructureNDTRequest.id.isnot(None))  # Only records with corresponding NDT request
    
    # Additional validation: ensure joint has all required identifiers
    q = q.filter(
        StructureNDTStatusRecord.structure_category.isnot(None),
        StructureNDTStatusRecord.page_no.isnot(None),
        StructureNDTStatusRecord.drawing_rev.isnot(None),
        StructureNDTStatusRecord.joint_no.isnot(None),
        StructureNDTStatusRecord.ndt_type.isnot(None)
    )
    
    return q.all()

@router.get("/structure/ndt-status-records", response_model=List[StructureNDTStatusRecordSchema])
def get_structure_ndt_status_records(
    project_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Get NDT status records for a structure project.
    Only returns records where:
    1. Final inspection is accepted
    2. Corresponding NDT request exists
    3. Joint is valid (has all required joint identifiers)
    """
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    
    # Query NDT status records with joins to validate relationships
    q = db.query(StructureNDTStatusRecord).join(
        StructureFinalInspection, StructureFinalInspection.id == StructureNDTStatusRecord.final_id
    ).outerjoin(
        StructureNDTRequest,
        and_(
            StructureNDTRequest.project_id == StructureNDTStatusRecord.project_id,
            StructureNDTRequest.structure_category == StructureNDTStatusRecord.structure_category,
            StructureNDTRequest.page_no == StructureNDTStatusRecord.page_no,
            StructureNDTRequest.drawing_rev == StructureNDTStatusRecord.drawing_rev,
            StructureNDTRequest.joint_no == StructureNDTStatusRecord.joint_no,
            StructureNDTRequest.ndt_type == StructureNDTStatusRecord.ndt_type
        )
    )
    
    q = q.filter(StructureNDTStatusRecord.project_id == project_id)
    q = q.filter(StructureFinalInspection.final_result.ilike('accepted'))
    q = q.filter(StructureNDTRequest.id.isnot(None))  # Only records with corresponding NDT request
    
    # Additional validation: ensure joint has all required identifiers
    q = q.filter(
        StructureNDTStatusRecord.structure_category.isnot(None),
        StructureNDTStatusRecord.page_no.isnot(None),
        StructureNDTStatusRecord.drawing_rev.isnot(None),
        StructureNDTStatusRecord.joint_no.isnot(None),
        StructureNDTStatusRecord.ndt_type.isnot(None)
    )
    
    return q.all()

# Structure NDT Requirements Routes
@router.get("/structure/ndt-requirements", response_model=List[dict])
def get_structure_ndt_requirements(
    project_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if current_user.role != 'admin' and project.id not in [p.id for p in current_user.assigned_projects]:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    
    requirements = db.query(NDTRequirement).filter(NDTRequirement.project_id == project_id).all()
    return [{"method": req.method, "required": req.required} for req in requirements]

@router.post("/structure/ndt-requirements", response_model=dict)
def create_structure_ndt_requirement(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == payload.get('project_id')).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    requirement = NDTRequirement(**payload)
    db.add(requirement)
    db.commit()
    db.refresh(requirement)
    return {"method": requirement.method, "required": requirement.required}

# General Registers (WPS & Welder) ΓÇö structure-only app exposure
@router.get("/wps-register")
def get_wps_register(
    skip: int = 0,
    limit: int = 20000,
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    query = db.query(WPSRegister)
    if project_id:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        if current_user.role != 'admin' and project.id not in [p.id for p in current_user.assigned_projects]:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
        query = query.filter(WPSRegister.project_id == project_id)
    else:
        if current_user.role != 'admin':
            user_project_ids = [p.id for p in current_user.assigned_projects]
            query = query.filter(WPSRegister.project_id.in_(user_project_ids))
    return query.offset(skip).limit(limit).all()

@router.post("/wps-register")
def create_wps_register(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_admin)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == payload.get('project_id')).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    wps = WPSRegister(**payload)
    db.add(wps)
    db.commit()
    db.refresh(wps)
    return wps

@router.put("/wps-register/{wps_id}")
def update_wps_register(
    wps_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_admin)
):
    wps = db.query(WPSRegister).filter(WPSRegister.id == wps_id).first()
    if not wps:
        raise HTTPException(status_code=404, detail="WPS not found")
    project = db.query(ProjectModel).filter(ProjectModel.id == wps.project_id).first()
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    for k, v in payload.items():
        setattr(wps, k, v)
    db.commit()
    db.refresh(wps)
    return wps

@router.delete("/wps-register/{wps_id}")
def delete_wps_register(
    wps_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_admin)
):
    wps = db.query(WPSRegister).filter(WPSRegister.id == wps_id).first()
    if not wps:
        raise HTTPException(status_code=404, detail="WPS not found")
    project = db.query(ProjectModel).filter(ProjectModel.id == wps.project_id).first()
    if current_user.role != 'admin' and project.id not in [p.id for p in current_user.assigned_projects]:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    db.delete(wps)
    db.commit()
    return {"message": "WPS deleted successfully"}

@router.get("/welder-register")
def get_welder_register(
    skip: int = 0,
    limit: int = 20000,
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    query = db.query(WelderRegister)
    if project_id:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        if current_user.role != 'admin' and project.id not in [p.id for p in current_user.assigned_projects]:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
        query = query.filter(WelderRegister.project_id == project_id)
    else:
        if current_user.role != 'admin':
            user_project_ids = [p.id for p in current_user.assigned_projects]
            query = query.filter(WelderRegister.project_id.in_(user_project_ids))
    return query.offset(skip).limit(limit).all()

@router.post("/welder-register")
def create_welder_register(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_admin)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == payload.get('project_id')).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        pt_date = payload.get('production_test_date')
        if pt_date:
            from datetime import datetime, timedelta
            try:
                base = datetime.fromisoformat(str(pt_date))
            except Exception:
                base = datetime.utcnow()
            month = base.month + 6
            year = base.year + (month - 1) // 12
            month = ((month - 1) % 12) + 1
            day = min(base.day, [31,29 if year%4==0 and (year%100!=0 or year%400==0) else 28,31,30,31,30,31,31,30,31,30,31][month-1])
            new_date = datetime(year, month, day)
            payload['validity'] = f"{new_date.day:02d}/{new_date.month:02d}/{str(new_date.year)[-2:]}"
        if 'production_test_date' in payload:
            payload.pop('production_test_date')
    except Exception:
        pass
    welder = WelderRegister(**payload)
    db.add(welder)
    db.commit()
    db.refresh(welder)
    return welder

@router.put("/welder-register/{welder_id}")
def update_welder_register(
    welder_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_admin)
):
    welder = db.query(WelderRegister).filter(WelderRegister.id == welder_id).first()
    if not welder:
        raise HTTPException(status_code=404, detail="Welder not found")
    project = db.query(ProjectModel).filter(ProjectModel.id == welder.project_id).first()
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    try:
        pt_date = payload.get('production_test_date')
        if pt_date:
            from datetime import datetime
            try:
                base = datetime.fromisoformat(str(pt_date))
            except Exception:
                base = datetime.utcnow()
            month = base.month + 6
            year = base.year + (month - 1) // 12
            month = ((month - 1) % 12) + 1
            day = min(base.day, [31,29 if year%4==0 and (year%100!=0 or year%400==0) else 28,31,30,31,30,31,31,30,31,30,31][month-1])
            new_date = datetime(year, month, day)
            payload['validity'] = f"{new_date.day:02d}/{new_date.month:02d}/{str(new_date.year)[-2:]}"
        if 'production_test_date' in payload:
            payload.pop('production_test_date')
    except Exception:
        pass
    for k, v in payload.items():
        setattr(welder, k, v)
    db.commit()
    db.refresh(welder)
    return welder

@router.delete("/welder-register/{welder_id}")
def delete_welder_register(
    welder_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_admin)
):
    welder = db.query(WelderRegister).filter(WelderRegister.id == welder_id).first()
    if not welder:
        raise HTTPException(status_code=404, detail="Welder not found")
    project = db.query(ProjectModel).filter(ProjectModel.id == welder.project_id).first()
    if current_user.role != 'admin' and project.id not in [p.id for p in current_user.assigned_projects]:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    db.delete(welder)
    db.commit()
    return {"message": "Welder deleted successfully"}

@router.get("/templates/structure-material.xlsx")
def download_structure_material_excel_template(
    current_user: UserModel = Depends(get_current_user)
):
    try:
        # Use exactly the 9 requested columns
        headers = [
            'Block no', 
            'Drawing No', 
            'Piece Mark No', 
            'Material Type', 
            'Grade', 
            'Thickness', 
            'Heat No', 
            'Material Report No', 
            'Structure Categor'
        ]
        sample_rows = [
            ['BLK001', 'DRW-001', 'PM-001', 'Plate', 'A36', '10MM', 'HT-001', 'MR-001', 'type-i'],
            ['BLK002', 'DRW-002', 'PM-002', 'Plate', 'A36', '12MM', 'HT-002', 'MR-002', 'type-ii'],
            ['BLK003', 'DRW-003', 'PM-003', 'Plate', 'A36', '15MM', 'HT-003', 'MR-003', 'Special'],
        ]
        import pandas as pd
        buf = io.BytesIO()
        df = pd.DataFrame(sample_rows, columns=headers)
        try:
            df.to_excel(buf, index=False)
            buf.seek(0)
            return StreamingResponse(
                buf,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": "attachment; filename=structure_material_template.xlsx"}
            )
        except Exception:
            # Fallback to CSV if Excel writer is not available
            buf = io.StringIO()
            df.to_csv(buf, index=False)
            return PlainTextResponse(
                buf.getvalue(),
                status_code=200,
                headers={"Content-Disposition": "attachment; filename=structure_material_template.csv"}
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate template: {str(e)}")

@router.post("/structure/ndt-status-records/ensure", response_model=StructureNDTStatusRecordSchema)
def ensure_structure_ndt_status_record(
    final_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    """
    Ensure an NDT Status Record exists for the given final_id.
    If it exists, return it. If not, create it from Final Inspection data.
    """
    try:
        # Check if exists
        rec = db.query(StructureNDTStatusRecord).filter(StructureNDTStatusRecord.final_id == final_id).first()
        if rec:
            return rec

        # Fetch Final Inspection
        final = db.query(StructureFinalInspection).filter(StructureFinalInspection.id == final_id).first()
        if not final:
            raise HTTPException(status_code=404, detail="Structure Final Inspection not found")

        # Try to get fitup details for additional information
        fitup = None
        if final.fitup_id:
            fitup = db.query(StructureFitUpInspection).filter(StructureFitUpInspection.id == final.fitup_id).first()
        
        # Create new record with safe defaults for missing fields
        new_rec = StructureNDTStatusRecord(
            project_id=final.project_id,
            final_id=final.id,
            block_no=getattr(final, 'block_no', None),
            draw_no=getattr(final, 'draw_no', None),
            joint_no=getattr(final, 'joint_no', None),
            structure_category=getattr(final, 'structure_category', None),
            page_no=getattr(final, 'page_no', None),
            # Try to get drawing_rev from fitup if available
            drawing_rev=getattr(fitup, 'drawing_rev', None) if fitup else None,
            # Calculate thickness from fitup
            thickness=(fitup.master_joint.thickness if fitup and fitup.master_joint else (fitup.part1_thickness or fitup.part2_thickness) if fitup else None),
            weld_type=getattr(final, 'weld_type', None),
            welder_no=getattr(final, 'welder_no', None),
            # Use weld_length from final if available, otherwise None
            weld_length=getattr(final, 'weld_length', None),
            weld_site=getattr(final, 'weld_site', None),
            ndt_type=getattr(final, 'ndt_type', None),
            ndt_report_no=getattr(final, 'final_report_no', None),
            ndt_result=getattr(final, 'final_result', None),
            rejected_length=0.0,
            # Set test_length to weld_length if available
            test_length=getattr(final, 'weld_length', None)
        )
        
        # If we have fitup, try to get additional fields
        if fitup:
            if not new_rec.block_no and getattr(fitup, 'block_no', None):
                new_rec.block_no = fitup.block_no
            if not new_rec.draw_no and getattr(fitup, 'draw_no', None):
                new_rec.draw_no = fitup.draw_no
            if not new_rec.structure_category and getattr(fitup, 'structure_category', None):
                new_rec.structure_category = fitup.structure_category
            if not new_rec.page_no and getattr(fitup, 'page_no', None):
                new_rec.page_no = fitup.page_no
            if not new_rec.drawing_rev and getattr(fitup, 'drawing_rev', None):
                new_rec.drawing_rev = fitup.drawing_rev
            if not new_rec.weld_site and getattr(fitup, 'weld_site', None):
                new_rec.weld_site = fitup.weld_site
        
        db.add(new_rec)
        db.commit()
        db.refresh(new_rec)
        return new_rec
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error ensuring NDT status record: {e}")
        # Provide more specific error message
        error_detail = f"Failed to create NDT status record: {str(e)}"
        if "NOT NULL constraint" in str(e):
            error_detail = "Missing required fields to create NDT status record. Please ensure the final inspection has all required joint information."
        elif "foreign key constraint" in str(e):
            error_detail = "Invalid final inspection reference."
        raise HTTPException(status_code=500, detail=error_detail)

@router.put("/structure/ndt-status-records/{record_id}", response_model=StructureNDTStatusRecordSchema)
def update_structure_ndt_status_record(
    record_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    try:
        rec = db.query(StructureNDTStatusRecord).filter(StructureNDTStatusRecord.id == record_id).first()
        if not rec:
            raise HTTPException(status_code=404, detail="Record not found")
            
        project = db.query(ProjectModel).filter(ProjectModel.id == rec.project_id).first()
        if current_user.role != 'admin' and project not in current_user.assigned_projects:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
            
        # Update fields
        for key, value in payload.items():
            if hasattr(rec, key):
                # Skip updating ID or other sensitive fields if they happen to be in payload
                if key in ['id', 'project_id', 'final_id', 'created_at', 'updated_at']:
                    continue
                setattr(rec, key, value)
                
        db.commit()
        db.refresh(rec)
        
        # Sync with NDT Test
        if rec.ndt_type:
            test = db.query(NDTTest).filter(NDTTest.final_id == rec.final_id, NDTTest.method == rec.ndt_type).first()
            if test:
                if 'ndt_result' in payload:
                    test.result = payload['ndt_result']
                if 'ndt_report_no' in payload:
                    test.report_no = payload['ndt_report_no']
                if 'test_length' in payload:
                    test.test_length = payload['test_length']
                db.commit()
                
        # Sync with NDT Request
        if rec.ndt_type:
            req = db.query(StructureNDTRequest).filter(
                StructureNDTRequest.final_id == rec.final_id, 
                StructureNDTRequest.ndt_type == rec.ndt_type
            ).first()
            if req:
                if 'ndt_result' in payload:
                    req.ndt_result = payload['ndt_result']
                if 'ndt_report_no' in payload:
                    req.ndt_report_no = payload['ndt_report_no']
                if 'test_length' in payload:
                    req.weld_size = payload['test_length']
                db.commit()
                
        return rec
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        import traceback
        traceback.print_exc()
        print(f"ERROR updating NDT status record: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.delete("/structure/ndt-status-records/{record_id}")
def delete_structure_ndt_status_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_admin)
):
    rec = db.query(StructureNDTStatusRecord).filter(StructureNDTStatusRecord.id == record_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Record not found")
        
    project = db.query(ProjectModel).filter(ProjectModel.id == rec.project_id).first()
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
        
    # Also delete corresponding NDT tests
    if rec.ndt_type:
        db.query(NDTTest).filter(NDTTest.final_id == rec.final_id, NDTTest.method == rec.ndt_type).delete()
        
    db.delete(rec)
    db.commit()
    return {"message": "Record deleted"}


# Bulk Operations for Final Inspections
@router.post("/structure/final-inspection/bulk-from-fitup")
def bulk_create_final_inspections_from_fitup(
    fitup_ids: List[int] = Body(..., description="List of fit-up IDs to create final inspections from"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    """
    Create final inspections from multiple fit-up records.
    Only fit-up records with "accepted" status will be processed.
    """
    if not fitup_ids:
        raise HTTPException(status_code=400, detail="No fit-up IDs provided")
    
    created_count = 0
    skipped_count = 0
    errors = []
    created_finals = []
    
    for fitup_id in fitup_ids:
        try:
            # Get fit-up record
            fitup = db.query(StructureFitUpInspection).filter(StructureFitUpInspection.id == fitup_id).first()
            if not fitup:
                errors.append(f"Fit-up ID {fitup_id}: Not found")
                skipped_count += 1
                continue
            
            # Check project access
            project = db.query(ProjectModel).filter(ProjectModel.id == fitup.project_id).first()
            if current_user.role != 'admin' and project not in current_user.assigned_projects:
                errors.append(f"Fit-up ID {fitup_id}: Not authorized to access this project")
                skipped_count += 1
                continue
            
            # Check if fit-up is accepted
            if (fitup.fit_up_result or '').lower() != 'accepted':
                errors.append(f"Fit-up ID {fitup_id}: Fit-up must have 'accepted' status")
                skipped_count += 1
                continue
            
            # Check if final already exists for this fit-up
            existing_final = db.query(StructureFinalInspection).filter(
                StructureFinalInspection.fitup_id == fitup_id
            ).first()
            
            if existing_final:
                errors.append(f"Fit-up ID {fitup_id}: Final inspection already exists (ID: {existing_final.id})")
                skipped_count += 1
                continue
            
            # Create final inspection from fit-up data
            # Use getattr with default None to handle missing attributes gracefully
            final_data = {
                'project_id': fitup.project_id,
                'fitup_id': fitup.id,
                'block_no': getattr(fitup, 'block_no', None),
                'draw_no': getattr(fitup, 'draw_no', None),
                'structure_category': getattr(fitup, 'structure_category', None),
                'page_no': getattr(fitup, 'page_no', None),
                'joint_no': getattr(fitup, 'joint_no', None),
                'weld_type': getattr(fitup, 'weld_type', None),
                'weld_length': getattr(fitup, 'weld_length', None),
                'weld_site': getattr(fitup, 'weld_site', None),
                'inspection_category': getattr(fitup, 'inspection_category', None),
                'final_result': 'pending',  # Default to pending
                # Leave empty for later filling
                'welder_no': None,
                'wps_no': None,
                'final_date': None,
                'final_report_no': None,
                'ndt_type': None,
            }
            
            # Create final inspection
            final = StructureFinalInspection(**final_data)
            db.add(final)
            db.commit()
            db.refresh(final)
            
            created_finals.append(final)
            created_count += 1
            
        except Exception as e:
            db.rollback()
            errors.append(f"Fit-up ID {fitup_id}: {str(e)}")
            skipped_count += 1
    
    return {
        "message": f"Created {created_count} final inspections, skipped {skipped_count}",
        "created_count": created_count,
        "skipped_count": skipped_count,
        "created_finals": created_finals,
        "errors": errors if errors else None
    }


@router.put("/structure/final-inspection/bulk-update")
def bulk_update_final_inspections(
    final_ids: List[int] = Body(..., description="List of final inspection IDs to update"),
    update_data: dict = Body(..., description="Fields to update for all selected finals"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    """
    Bulk update multiple final inspections with the same field values.
    Only updates specified fields: welder_no, wps_no, final_report_no, final_date, ndt_type, final_result
    """
    if not final_ids:
        raise HTTPException(status_code=400, detail="No final inspection IDs provided")
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    # Only allow specific fields to be updated in bulk
    allowed_fields = {'welder_no', 'wps_no', 'final_report_no', 'final_date', 'ndt_type', 'final_result'}
    update_fields = {k: v for k, v in update_data.items() if k in allowed_fields}
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No valid fields to update. Allowed fields: welder_no, wps_no, final_report_no, final_date, ndt_type, final_result")
    
    updated_count = 0
    errors = []
    
    for final_id in final_ids:
        try:
            # Get final inspection
            final = db.query(StructureFinalInspection).filter(StructureFinalInspection.id == final_id).first()
            if not final:
                errors.append(f"Final ID {final_id}: Not found")
                continue
            
            # Check project access
            project = db.query(ProjectModel).filter(ProjectModel.id == final.project_id).first()
            if current_user.role != 'admin' and project not in current_user.assigned_projects:
                errors.append(f"Final ID {final_id}: Not authorized to access this project")
                continue
            
            # Check if inspector is trying to edit accepted final
            if (current_user.role or '').lower() == 'inspector':
                s = (final.final_result or '').lower()
                if s == 'accepted':
                    errors.append(f"Final ID {final_id}: Not authorized to edit accepted final as inspector")
                    continue
            
            # Apply updates
            for field, value in update_fields.items():
                if field == 'final_date' and value:
                    try:
                        if isinstance(value, str):
                            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
                    except Exception:
                        value = None
                
                setattr(final, field, value)
            
            # Auto-fill welder_validity if welder_no changed
            if 'welder_no' in update_fields and update_fields['welder_no'] and not final.welder_validity:
                w = db.query(WelderRegister).filter(
                    WelderRegister.project_id == final.project_id,
                    WelderRegister.welder_no == update_fields['welder_no']
                ).first()
                if w and getattr(w, 'validity', None):
                    final.welder_validity = w.validity
            
            db.commit()
            updated_count += 1
            
        except Exception as e:
            db.rollback()
            errors.append(f"Final ID {final_id}: {str(e)}")
    
    return {
        "message": f"Updated {updated_count} final inspections",
        "updated_count": updated_count,
        "errors": errors if errors else None
    }
