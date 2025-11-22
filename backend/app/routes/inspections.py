from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import Optional, List
import re
import csv
import io
import logging
import os
import json
import pandas as pd
from datetime import datetime
from app.database import get_db
from app.models import (
    MasterJointList, MaterialRegister, MaterialInspection,
    FitUpInspection, FinalInspection, NDTRequest, NDTTest, NDTStatusRecord,
    WPSRegister, WelderRegister, NDTRequirement,
    User as UserModel, Project as ProjectModel
)
from app.schemas import (
    MasterJointList as MasterJointListSchema, MasterJointListCreate,
    MaterialRegister as MaterialRegisterSchema, MaterialRegisterCreate,
    MaterialInspection as MaterialInspectionSchema, MaterialInspectionCreate,
    FitUpInspection as FitUpInspectionSchema, FitUpInspectionCreate,
    FinalInspection as FinalInspectionSchema, FinalInspectionCreate,
    NDTRequest as NDTRequestSchema, NDTRequestCreate,
    NDTTest as NDTTestSchema, NDTTestCreate, NDTJointStatus, NDTStatusRecord as NDTStatusRecordSchema
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

# Master Joint List Routes
@router.get("/master-joint-list", response_model=List[MasterJointListSchema])
def get_master_joint_list(
    skip: int = 0,
    limit: int = 100,
    project_id: Optional[int] = Query(None),
    system_no: Optional[str] = Query(None),
    line_no: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    query = db.query(MasterJointList)
    
    # Filter by project access
    if project_id:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        if current_user.role != 'admin' and project not in current_user.assigned_projects:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
        query = query.filter(MasterJointList.project_id == project_id)
    else:
        # Only show master joints for projects user has access to
        if current_user.role != 'admin':
            user_project_ids = [p.id for p in current_user.assigned_projects]
            query = query.filter(MasterJointList.project_id.in_(user_project_ids))
    
    # Additional filters
    if system_no:
        query = query.filter(MasterJointList.system_no.contains(system_no))
    if line_no:
        query = query.filter(MasterJointList.line_no.contains(line_no))
    
    return query.offset(skip).limit(limit).all()

@router.post("/master-joint-list", response_model=MasterJointListSchema)
def create_master_joint(
    master_joint: MasterJointListCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    # Verify project access
    project = db.query(ProjectModel).filter(ProjectModel.id == master_joint.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db_master_joint = MasterJointList(**master_joint.model_dump())
    db.add(db_master_joint)
    db.commit()
    db.refresh(db_master_joint)
    return db_master_joint

@router.put("/master-joint-list/{joint_id}", response_model=MasterJointListSchema)
def update_master_joint(
    joint_id: int,
    joint_update: dict,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    joint = db.query(MasterJointList).filter(MasterJointList.id == joint_id).first()
    if not joint:
        raise HTTPException(status_code=404, detail="Master joint not found")
    project = db.query(ProjectModel).filter(ProjectModel.id == joint.project_id).first()
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
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

@router.delete("/master-joint-list/{joint_id}")
def delete_master_joint(
    joint_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_admin)
):
    joint = db.query(MasterJointList).filter(MasterJointList.id == joint_id).first()
    if not joint:
        raise HTTPException(status_code=404, detail="Master joint not found")
    project = db.query(ProjectModel).filter(ProjectModel.id == joint.project_id).first()
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    db.delete(joint)
    db.commit()
    return {"message": "Master joint deleted successfully"}

@router.post("/master-joint-list/upload")
def upload_master_joint_list(
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
            'system_no': ['system_no'],
            'line_no': ['line_no'],
            'spool_no': ['spool_no'],
            'joint_no': ['joint_no'],
            'pipe_dia': ['pipe_dia', 'dia', 'diameter'],
            'weld_type': ['weld_type'],
            'part1_piece_mark_no': ['part1_piece_mark_no', 'part_1_piece_mark', 'part1_piece_mark'],
            'part2_piece_mark_no': ['part2_piece_mark_no', 'part_2_piece_mark', 'part2_piece_mark'],
            'fitup_status': ['fitup_status', 'fit_up_status'],
            'final_status': ['final_status']
        }

        def get_val(nrow: dict, keys: List[str]):
            for k in keys:
                if k in nrow and nrow[k] is not None:
                    return nrow[k]
            return None

        columns_norm = set()
        for r in records:
            columns_norm.update(norm_key(k) for k in r.keys())
        required_groups = ['draw_no', 'system_no', 'line_no', 'spool_no', 'joint_no']
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
                pipe_val = get_val(nrow, syn['pipe_dia'])
                master_joint_data = {
                    'project_id': project_id,
                    'draw_no': str(get_val(nrow, syn['draw_no']) or '').strip(),
                    'system_no': str(get_val(nrow, syn['system_no']) or '').strip(),
                    'line_no': str(get_val(nrow, syn['line_no']) or '').strip(),
                    'spool_no': str(get_val(nrow, syn['spool_no']) or '').strip(),
                    'joint_no': str(get_val(nrow, syn['joint_no']) or '').strip(),
                    'pipe_dia': (str(pipe_val).strip() or None) if pipe_val is not None else None,
                    'weld_type': (str(get_val(nrow, syn['weld_type']) or '').strip() or None),
                    'part1_piece_mark_no': (str(get_val(nrow, syn['part1_piece_mark_no']) or '').strip() or None),
                    'part2_piece_mark_no': (str(get_val(nrow, syn['part2_piece_mark_no']) or '').strip() or None),
                    'fitup_status': (str(get_val(nrow, syn['fitup_status']) or 'pending').strip() or 'pending'),
                    'final_status': (str(get_val(nrow, syn['final_status']) or 'pending').strip() or 'pending')
                }
                if not all([master_joint_data['draw_no'], master_joint_data['system_no'], master_joint_data['line_no'], master_joint_data['spool_no'], master_joint_data['joint_no']]):
                    raise ValueError('Required fields missing')
                existing_joint = db.query(MasterJointList).filter(
                    MasterJointList.project_id == project_id,
                    MasterJointList.draw_no == master_joint_data['draw_no'],
                    MasterJointList.system_no == master_joint_data['system_no'],
                    MasterJointList.line_no == master_joint_data['line_no'],
                    MasterJointList.spool_no == master_joint_data['spool_no'],
                    MasterJointList.joint_no == master_joint_data['joint_no']
                ).first()
                if existing_joint:
                    for key, value in master_joint_data.items():
                        if key != 'project_id':
                            setattr(existing_joint, key, value)
                else:
                    db.add(MasterJointList(**master_joint_data))
                created_count += 1
            except Exception as e:
                errors.append(f"Row {index}: {str(e)}")
        db.commit()
        return {"message": f"Successfully processed {created_count} joints", "created_count": created_count, "errors": errors or None}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing file: {str(e)}")

# Material Register Routes
@router.get("/material-register", response_model=List[MaterialRegisterSchema])
def get_material_register(
    skip: int = 0,
    limit: int = 100,
    project_id: Optional[int] = Query(None),
    piece_mark_no: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    query = db.query(MaterialRegister)
    
    # Filter by project access
    if project_id:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        if current_user.role != 'admin' and project not in current_user.assigned_projects:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
        query = query.filter(MaterialRegister.project_id == project_id)
    else:
        if current_user.role != 'admin':
            user_project_ids = [p.id for p in current_user.assigned_projects]
            query = query.filter(MaterialRegister.project_id.in_(user_project_ids))
    
    if piece_mark_no:
        query = query.filter(MaterialRegister.piece_mark_no.contains(piece_mark_no))
    
    return query.offset(skip).limit(limit).all()

@router.post("/material-register", response_model=MaterialRegisterSchema)
def create_material_register(
    material: MaterialRegisterCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == material.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db_material = MaterialRegister(**material.model_dump())
    db.add(db_material)
    db.commit()
    db.refresh(db_material)
    return db_material

@router.post("/material-register/upload")
def upload_material_register(
    project_id: int = Query(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    allowed_types = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    if (file.content_type not in allowed_types) and (not file.filename.endswith(('.csv', '.xlsx', '.xls'))):
        raise HTTPException(status_code=400, detail="File must be CSV or Excel format")
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
    # Normalize column names helper
    def _norm_key(k: str) -> str:
        s = str(k or '').strip().lower().replace(' ', '_').lstrip('\ufeff')
        synonyms = {
            'piece_mark': 'piece_mark_no',
            'piece_mark_no': 'piece_mark_no',
            'piece_mark_number': 'piece_mark_no',
            'piece_no': 'piece_mark_no',
            'material_type': 'material_type',
            'material': 'material_type',
            'grade': 'grade',
            'thickness': 'thickness',
            'thk': 'thickness',
            'heat_no': 'heat_no',
            'heat_number': 'heat_no',
            'spec': 'spec',
            'category': 'category',
            'pipe_dia': 'pipe_dia',
            'pipe_diameter': 'pipe_dia',
            'dia': 'pipe_dia',
            'diameter': 'pipe_dia',
            'inspection_status': 'inspection_status',
            'status': 'inspection_status',
        }
        return synonyms.get(s, s)

    created_count = 0
    updated_count = 0
    errors: List[str] = []
    batch_cache: dict[str, MaterialRegister] = {}
    for idx, row in enumerate(records, start=2):
        try:
            nrow = { _norm_key(k): v for k, v in (row or {}).items() }
            piece = str(nrow.get('piece_mark_no', '')).strip()
            if not piece:
                raise ValueError('piece_mark_no required')
            data = {
                'project_id': project_id,
                'piece_mark_no': piece,
                'material_type': (str(nrow.get('material_type', '')).strip() or None),
                'grade': (str(nrow.get('grade', '')).strip() or None),
                'thickness': (str(nrow.get('thickness', '')).strip() or None),
                'heat_no': (str(nrow.get('heat_no', '')).strip() or None),
                'spec': (str(nrow.get('spec', '')).strip() or None),
                'category': (str(nrow.get('category', '')).strip() or None),
                'pipe_dia': (str(nrow.get('pipe_dia', '')).strip() or None),
                'inspection_status': (str(nrow.get('inspection_status', 'pending')).strip() or 'pending')
            }
            s = (data['inspection_status'] or 'pending').lower()
            if s not in ('pending', 'inspected', 'rejected'):
                s = 'pending'
            data['inspection_status'] = s

            target = batch_cache.get(piece)
            if target is None:
                target = db.query(MaterialRegister).filter(
                    MaterialRegister.project_id == project_id,
                    MaterialRegister.piece_mark_no == piece
                ).first()
            if target:
                for k, v in data.items():
                    if k != 'project_id' and v is not None:
                        setattr(target, k, v)
                batch_cache[piece] = target
                updated_count += 1
            else:
                target = MaterialRegister(**data)
                db.add(target)
                batch_cache[piece] = target
                created_count += 1
            
        except Exception as e:
            errors.append(f"Row {idx}: {str(e)}")
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to save materials: {str(e)}")
    return {"created": created_count, "updated": updated_count, "errors": errors or None}

@router.put("/material-register/{material_id}", response_model=MaterialRegisterSchema)
def update_material_register(
    material_id: int,
    material_update: dict,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    db_material = db.query(MaterialRegister).filter(MaterialRegister.id == material_id).first()
    if not db_material:
        raise HTTPException(status_code=404, detail="Material not found")
    project = db.query(ProjectModel).filter(ProjectModel.id == db_material.project_id).first()
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    update_data = material_update if isinstance(material_update, dict) else material_update.model_dump(exclude_unset=True)
    allowed_fields = {"piece_mark_no", "material_type", "grade", "thickness", "heat_no", "spec", "category", "pipe_dia", "inspection_status"}
    for k, v in update_data.items():
        if k in allowed_fields:
            setattr(db_material, k, v)
    try:
        db.commit()
        db.refresh(db_material)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to update material: {str(e)}")
    return db_material

@router.delete("/material-register/{material_id}")
def delete_material_register(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_admin)
):
    db_material = db.query(MaterialRegister).filter(MaterialRegister.id == material_id).first()
    if not db_material:
        raise HTTPException(status_code=404, detail="Material not found")
    project = db.query(ProjectModel).filter(ProjectModel.id == db_material.project_id).first()
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    db.delete(db_material)
    db.commit()
    return {"message": "Material deleted successfully"}

@router.get("/material-register/{piece_mark_no}/lookup")
def lookup_material_by_piece_mark(
    piece_mark_no: str,
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    query = db.query(MaterialRegister).filter(MaterialRegister.piece_mark_no == piece_mark_no)
    
    # Filter by project if specified
    if project_id:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        if current_user.role != 'admin' and project not in current_user.assigned_projects:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
        query = query.filter(MaterialRegister.project_id == project_id)
    else:
        if current_user.role != 'admin':
            user_project_ids = [p.id for p in current_user.assigned_projects]
            query = query.filter(MaterialRegister.project_id.in_(user_project_ids))
    
    material = query.first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    
    return {
        "piece_mark_no": material.piece_mark_no,
        "material_type": material.material_type,
        "grade": material.grade,
        "thickness": material.thickness,
        "heat_no": material.heat_no,
        "spec": material.spec,
        "category": material.category
    }

# Material Inspection Routes
@router.get("/material-inspection", response_model=List[MaterialInspectionSchema])
def get_material_inspections(
    skip: int = 0,
    limit: int = 100,
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    query = db.query(MaterialInspection)
    
    if project_id:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        if current_user.role != 'admin' and project not in current_user.assigned_projects:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
        query = query.filter(MaterialInspection.project_id == project_id)
    else:
        if current_user.role != 'admin':
            user_project_ids = [p.id for p in current_user.assigned_projects]
            query = query.filter(MaterialInspection.project_id.in_(user_project_ids))
    
    return query.offset(skip).limit(limit).all()

@router.post("/material-inspection", response_model=MaterialInspectionSchema)
def create_material_inspection(
    inspection: MaterialInspectionCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == inspection.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Validate piece mark exists
    material = db.query(MaterialRegister).filter(
        and_(
            MaterialRegister.project_id == inspection.project_id,
            MaterialRegister.piece_mark_no == inspection.piece_mark_no
        )
    ).first()
    if not material:
        raise HTTPException(status_code=404, detail="Piece mark not found in material register")
    
    db_inspection = MaterialInspection(**inspection.model_dump())
    db.add(db_inspection)
    
    # Update material inspection status
    material.inspection_status = "inspected"
    
    db.commit()
    db.refresh(db_inspection)
    return db_inspection

# Fit-up Inspection Routes
@router.get("/fitup-inspection", response_model=List[FitUpInspectionSchema])
def get_fitup_inspections(
    skip: int = 0,
    limit: int = 100,
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    query = db.query(FitUpInspection)
    
    if project_id:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        if current_user.role != 'admin' and project not in current_user.assigned_projects:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
        query = query.filter(FitUpInspection.project_id == project_id)
    else:
        if current_user.role != 'admin':
            user_project_ids = [p.id for p in current_user.assigned_projects]
            query = query.filter(FitUpInspection.project_id.in_(user_project_ids))
    
    return query.offset(skip).limit(limit).all()

@router.get("/fitup-inspection/filters")
def get_fitup_filters(
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    query = db.query(FitUpInspection)
    if project_id:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        if current_user.role != 'admin' and project not in current_user.assigned_projects:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
        query = query.filter(FitUpInspection.project_id == project_id)
    else:
        if current_user.role != 'admin':
            user_project_ids = [p.id for p in current_user.assigned_projects]
            query = query.filter(FitUpInspection.project_id.in_(user_project_ids))

    rows = query.all()
    def uniq(vals):
        return sorted([v for v in set([str(x).strip() for x in vals if x]) if v])

    return {
        "system_no": uniq([r.system_no for r in rows]),
        "spool_no": uniq([r.spool_no for r in rows]),
        "joint_no": uniq([r.joint_no for r in rows]),
        "fit_up_report_no": uniq([r.fit_up_report_no for r in rows]),
        "fit_up_result": uniq([r.fit_up_result for r in rows])
    }

@router.post("/fitup-inspection", response_model=FitUpInspectionSchema)
def create_fitup_inspection(
    fitup: FitUpInspectionCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == fitup.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    fitup_data = fitup.model_dump()
    if fitup_data.get("fit_up_date"):
        try:
            val = fitup_data["fit_up_date"]
            if isinstance(val, str):
                fitup_data["fit_up_date"] = datetime.fromisoformat(val.replace("Z", "+00:00"))
        except Exception:
            fitup_data["fit_up_date"] = None
    if fitup.part1_piece_mark_no:
        part1_material = db.query(MaterialRegister).filter(
            and_(
                MaterialRegister.project_id == fitup.project_id,
                MaterialRegister.piece_mark_no == fitup.part1_piece_mark_no
            )
        ).first()
        if part1_material:
            fitup_data["part1_material_type"] = part1_material.material_type
            fitup_data["part1_grade"] = part1_material.grade
            fitup_data["part1_thickness"] = part1_material.thickness
            fitup_data["part1_heat_no"] = part1_material.heat_no
    if fitup.part2_piece_mark_no:
        part2_material = db.query(MaterialRegister).filter(
            and_(
                MaterialRegister.project_id == fitup.project_id,
                MaterialRegister.piece_mark_no == fitup.part2_piece_mark_no
            )
        ).first()
        if part2_material:
            fitup_data["part2_material_type"] = part2_material.material_type
            fitup_data["part2_grade"] = part2_material.grade
            fitup_data["part2_thickness"] = part2_material.thickness
            fitup_data["part2_heat_no"] = part2_material.heat_no
    # Auto-calculate weld_length from dia if not provided
    try:
        if (not fitup_data.get("weld_length")) and fitup_data.get("dia"):
            s = str(fitup_data.get("dia") or "")
            import re
            m = re.search(r"([0-9]+(?:\.[0-9]+)?)", s)
            if m:
                dval = float(m.group(1))
                factor = 25.4 if '"' in s else 1
                fitup_data["weld_length"] = round(3.14 * dval * factor, 3)
    except Exception:
        pass
    try:
        db_fitup = FitUpInspection(**fitup_data)
        db.add(db_fitup)
        db.commit()
        db.refresh(db_fitup)
        try:
            joint = None
            if db_fitup.master_joint_id:
                joint = db.query(MasterJointList).filter(MasterJointList.id == db_fitup.master_joint_id).first()
            if not joint:
                joint = db.query(MasterJointList).filter(
                    MasterJointList.project_id == db_fitup.project_id,
                    MasterJointList.system_no == (db_fitup.system_no or ""),
                    MasterJointList.line_no == (db_fitup.line_no or ""),
                    MasterJointList.spool_no == (db_fitup.spool_no or ""),
                    MasterJointList.joint_no == (db_fitup.joint_no or "")
                ).first()
            if joint:
                if db_fitup.fit_up_report_no:
                    joint.fit_up_report_no = db_fitup.fit_up_report_no
                if (db_fitup.fit_up_result or '').lower() == 'accepted' and db_fitup.fit_up_report_no:
                    joint.fitup_status = db_fitup.fit_up_report_no
                db.commit()
        except Exception:
            pass
        return db_fitup
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to create fit-up: {str(e)}")

@router.put("/fitup-inspection/{fitup_id}", response_model=FitUpInspectionSchema)
def update_fitup_inspection(
    fitup_id: int,
    fitup_update: dict,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    fitup = db.query(FitUpInspection).filter(FitUpInspection.id == fitup_id).first()
    if not fitup:
        raise HTTPException(status_code=404, detail="Fit-up inspection not found")
    
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
    
    # Auto-populate material details if piece marks are updated
    if "part1_piece_mark_no" in update_data and update_data["part1_piece_mark_no"]:
        part1_material = db.query(MaterialRegister).filter(
            and_(
                MaterialRegister.project_id == fitup.project_id,
                MaterialRegister.piece_mark_no == update_data["part1_piece_mark_no"]
            )
        ).first()
        if part1_material:
            update_data["part1_material_type"] = part1_material.material_type
            update_data["part1_grade"] = part1_material.grade
            update_data["part1_thickness"] = part1_material.thickness
            update_data["part1_heat_no"] = part1_material.heat_no
    
    if "part2_piece_mark_no" in update_data and update_data["part2_piece_mark_no"]:
        part2_material = db.query(MaterialRegister).filter(
            and_(
                MaterialRegister.project_id == fitup.project_id,
                MaterialRegister.piece_mark_no == update_data["part2_piece_mark_no"]
            )
        ).first()
        if part2_material:
            update_data["part2_material_type"] = part2_material.material_type
            update_data["part2_grade"] = part2_material.grade
            update_data["part2_thickness"] = part2_material.thickness
            update_data["part2_heat_no"] = part2_material.heat_no
    # Auto-calculate weld_length from dia if provided/changed and weld_length missing
    try:
        if (not update_data.get("weld_length")) and update_data.get("dia"):
            s = str(update_data.get("dia") or "")
            import re
            m = re.search(r"([0-9]+(?:\.[0-9]+)?)", s)
            if m:
                dval = float(m.group(1))
                factor = 25.4 if '"' in s else 1
                update_data["weld_length"] = round(3.14 * dval * factor, 3)
    except Exception:
        pass
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
            joint = db.query(MasterJointList).filter(MasterJointList.id == fitup.master_joint_id).first()
        if not joint:
            joint = db.query(MasterJointList).filter(
                MasterJointList.project_id == fitup.project_id,
                MasterJointList.system_no == (fitup.system_no or ""),
                MasterJointList.line_no == (fitup.line_no or ""),
                MasterJointList.spool_no == (fitup.spool_no or ""),
                MasterJointList.joint_no == (fitup.joint_no or "")
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

@router.delete("/fitup-inspection/{fitup_id}")
def delete_fitup_inspection(
    fitup_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_admin)
):
    fitup = db.query(FitUpInspection).filter(FitUpInspection.id == fitup_id).first()
    if not fitup:
        raise HTTPException(status_code=404, detail="Fit-up inspection not found")
    
    # Check project access
    project = db.query(ProjectModel).filter(ProjectModel.id == fitup.project_id).first()
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    
    before = _audit_snapshot(fitup)
    db.delete(fitup)
    db.commit()
    try:
        _audit("fitup", "delete", current_user, before=before, after=None, record_id=fitup.id, project_id=fitup.project_id)
    except Exception:
        pass
    return {"message": "Fit-up inspection deleted successfully"}

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

# Final Inspection Routes
@router.get("/final-inspection", response_model=List[FinalInspectionSchema])
def get_final_inspections(
    skip: int = 0,
    limit: int = 100,
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    query = db.query(FinalInspection).options(joinedload(FinalInspection.fitup))
    
    if project_id:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        if current_user.role != 'admin' and project not in current_user.assigned_projects:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
        query = query.filter(FinalInspection.project_id == project_id)
    else:
        if current_user.role != 'admin':
            user_project_ids = [p.id for p in current_user.assigned_projects]
            query = query.filter(FinalInspection.project_id.in_(user_project_ids))
    
    final_inspections = query.offset(skip).limit(limit).all()
    
    # Add joint information from fit-up records
    for final_inspection in final_inspections:
        if final_inspection.fitup:
            final_inspection.system_no = final_inspection.fitup.system_no
            final_inspection.line_no = final_inspection.fitup.line_no
            final_inspection.spool_no = final_inspection.fitup.spool_no
            final_inspection.joint_no = final_inspection.fitup.joint_no
    
    return final_inspections

@router.get("/final-inspection/filters")
def get_final_filters(
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    query = db.query(FinalInspection)
    if project_id:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        if current_user.role != 'admin' and project not in current_user.assigned_projects:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
        query = query.filter(FinalInspection.project_id == project_id)
    else:
        if current_user.role != 'admin':
            user_project_ids = [p.id for p in current_user.assigned_projects]
            query = query.filter(FinalInspection.project_id.in_(user_project_ids))

    rows = query.all()
    def uniq(vals):
        return sorted([v for v in set([str(x).strip() for x in vals if x]) if v])

    return {
        "system_no": uniq([r.system_no for r in rows]),
        "spool_no": uniq([r.spool_no for r in rows]),
        "joint_no": uniq([r.joint_no for r in rows]),
        "final_report_no": uniq([r.final_report_no for r in rows]),
        "final_result": uniq([r.final_result for r in rows])
    }

@router.post("/final-inspection", response_model=FinalInspectionSchema)
def create_final_inspection(
    final: FinalInspectionCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == final.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Verify fitup exists if fitup_id is provided
    if final.fitup_id:
        fitup = db.query(FitUpInspection).filter(FitUpInspection.id == final.fitup_id).first()
        if not fitup:
            raise HTTPException(status_code=404, detail="Fit-up inspection not found")
        if fitup.project_id != final.project_id:
            raise HTTPException(status_code=400, detail="Fit-up and Final must belong to the same project")
    
    data = final.model_dump()
    if not data.get('welder_validity') and data.get('welder_no'):
        w = db.query(WelderRegister).filter(WelderRegister.project_id == final.project_id, WelderRegister.welder_no == data.get('welder_no')).first()
        if w and getattr(w, 'validity', None):
            data['welder_validity'] = w.validity
    db_final = FinalInspection(**data)
    db.add(db_final)
    db.commit()
    db.refresh(db_final)
    # Create persistent NDT status record for this final
    existing = db.query(NDTStatusRecord).filter(NDTStatusRecord.final_id == db_final.id).first()
    if not existing:
        fitup = db.query(FitUpInspection).filter(FitUpInspection.id == db_final.fitup_id).first()
        m = getattr(db_final, 'ndt_type', None)
        parts = [p.strip() for p in re.split(r"[,;/\s]+", m or "") if p.strip()]
        rec = NDTStatusRecord(
            project_id=db_final.project_id,
            final_id=db_final.id,
            system_no=(getattr(fitup, 'system_no', None) or getattr(db_final, 'system_no', None)),
            line_no=(getattr(fitup, 'line_no', None) or getattr(db_final, 'line_no', None)),
            spool_no=(getattr(fitup, 'spool_no', None) or getattr(db_final, 'spool_no', None)),
            joint_no=(getattr(fitup, 'joint_no', None) or getattr(db_final, 'joint_no', None)),
            weld_type=(getattr(fitup, 'weld_type', None) or getattr(db_final, 'weld_type', None)),
            welder_no=db_final.welder_no,
            weld_size=db_final.weld_length,
            rejected_length=0.0,
            weld_site=getattr(fitup, 'weld_site', None),
            pipe_dia=(getattr(fitup, 'dia', None) or getattr(db_final, 'pipe_dia', None)),
            ndt_type=(parts[0] if len(parts) == 1 else None),
        )
        db.add(rec)
        db.commit()
    try:
        joint = None
        if db_final.fitup_id:
            fitup = db.query(FitUpInspection).filter(FitUpInspection.id == db_final.fitup_id).first()
            if getattr(fitup, 'master_joint_id', None):
                joint = db.query(MasterJointList).filter(MasterJointList.id == fitup.master_joint_id).first()
        if not joint:
            joint = db.query(MasterJointList).filter(
                MasterJointList.project_id == db_final.project_id,
                MasterJointList.system_no == (db_final.system_no or getattr(fitup, 'system_no', '') or ''),
                MasterJointList.line_no == (db_final.line_no or getattr(fitup, 'line_no', '') or ''),
                MasterJointList.spool_no == (db_final.spool_no or getattr(fitup, 'spool_no', '') or ''),
                MasterJointList.joint_no == (db_final.joint_no or getattr(fitup, 'joint_no', '') or ''),
            ).first()
        if joint and (db_final.final_result or '').lower() == 'accepted' and db_final.final_report_no:
            joint.final_status = db_final.final_report_no
            db.commit()
    except Exception:
        pass
    return db_final

@router.put("/final-inspection/{final_id}", response_model=FinalInspectionSchema)
def update_final_inspection(
    final_id: int,
    final_update: dict,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    final = db.query(FinalInspection).filter(FinalInspection.id == final_id).first()
    if not final:
        raise HTTPException(status_code=404, detail="Final inspection not found")
    
    # Check project access
    project = db.query(ProjectModel).filter(ProjectModel.id == final.project_id).first()
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    
    if (current_user.role or '').lower() == 'inspector':
        s = (final.final_result or '').lower()
        if s == 'accepted':
            raise HTTPException(status_code=403, detail="Not authorized to edit accepted final as inspector")
    update_data = final_update if isinstance(final_update, dict) else final_update.model_dump(exclude_unset=True)
    immutable = {'id', 'project_id', 'created_at'}
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
        fitup = db.query(FitUpInspection).filter(FitUpInspection.id == update_data["fitup_id"]).first()
        if not fitup:
            raise HTTPException(status_code=404, detail="Fit-up inspection not found")
        if fitup.project_id != final.project_id:
            raise HTTPException(status_code=400, detail="Fit-up and Final must belong to the same project")
    
    # Auto-fill welder_validity if welder_no changed and validity missing
    if (not update_data.get('welder_validity')) and update_data.get('welder_no'):
        w = db.query(WelderRegister).filter(WelderRegister.project_id == final.project_id, WelderRegister.welder_no == update_data.get('welder_no')).first()
        if w and getattr(w, 'validity', None):
            update_data['welder_validity'] = w.validity
    before = _audit_snapshot(final)
    for field, value in update_data.items():
        setattr(final, field, value)
    
    db.commit()
    db.refresh(final)
    try:
        joint = None
        fitup = None
        if final.fitup_id:
            fitup = db.query(FitUpInspection).filter(FitUpInspection.id == final.fitup_id).first()
            if getattr(fitup, 'master_joint_id', None):
                joint = db.query(MasterJointList).filter(MasterJointList.id == fitup.master_joint_id).first()
        if not joint:
            joint = db.query(MasterJointList).filter(
                MasterJointList.project_id == final.project_id,
                MasterJointList.system_no == (final.system_no or getattr(fitup, 'system_no', '') or ''),
                MasterJointList.line_no == (final.line_no or getattr(fitup, 'line_no', '') or ''),
                MasterJointList.spool_no == (final.spool_no or getattr(fitup, 'spool_no', '') or ''),
                MasterJointList.joint_no == (final.joint_no or getattr(fitup, 'joint_no', '') or ''),
            ).first()
        if joint and (final.final_result or '').lower() == 'accepted' and final.final_report_no:
            joint.final_status = final.final_report_no
            db.commit()
    except Exception:
        pass
    return final

@router.delete("/final-inspection/{final_id}")
def delete_final_inspection(
    final_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_admin)
):
    final = db.query(FinalInspection).filter(FinalInspection.id == final_id).first()
    if not final:
        raise HTTPException(status_code=404, detail="Final inspection not found")
    
    # Check project access
    project = db.query(ProjectModel).filter(ProjectModel.id == final.project_id).first()
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    
    # Cascade delete dependent records referencing this final
    db.query(NDTStatusRecord).filter(NDTStatusRecord.final_id == final.id).delete(synchronize_session=False)
    db.query(NDTRequest).filter(NDTRequest.final_id == final.id).delete(synchronize_session=False)
    db.query(NDTTest).filter(NDTTest.final_id == final.id).delete(synchronize_session=False)

    before = _audit_snapshot(final)
    db.delete(final)
    db.commit()
    try:
        _audit("final", "delete", current_user, before=before, after=None, record_id=final.id, project_id=final.project_id)
    except Exception:
        pass
    return {"message": "Final inspection deleted successfully"}

# NDT Request Routes
@router.get("/ndt-requests", response_model=List[NDTRequestSchema])
def get_ndt_requests(
    skip: int = 0,
    limit: int = 100,
    project_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    query = db.query(NDTRequest)
    
    if project_id:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        if current_user.role != 'admin' and project not in current_user.assigned_projects:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
        query = query.filter(NDTRequest.project_id == project_id)
    else:
        if current_user.role != 'admin':
            user_project_ids = [p.id for p in current_user.assigned_projects]
            query = query.filter(NDTRequest.project_id.in_(user_project_ids))
    
    if status:
        query = query.filter(NDTRequest.status == status)
    
    return query.offset(skip).limit(limit).all()

@router.post("/ndt-requests", response_model=NDTRequestSchema)
def create_ndt_request(
    ndt: NDTRequestCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == ndt.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Validate that final_id is provided and the final inspection exists and is accepted
    if not ndt.final_id:
        raise HTTPException(status_code=400, detail="final_id is required to link NDT request to a final inspection")
    
    final = db.query(FinalInspection).filter(FinalInspection.id == ndt.final_id).first()
    if not final:
        raise HTTPException(status_code=404, detail="Final inspection not found")
    
    # Check if final inspection is accepted (case-insensitive)
    if (final.final_result or "").lower() != "accepted":
        raise HTTPException(status_code=400, detail="Only joints with accepted final inspection can be requested for NDT")
    
    # Auto-populate project details
    if not ndt.project_name:
        ndt.project_name = project.name
    if not ndt.project_code:
        ndt.project_code = project.code
    
    # Get fitup details to inherit joint information
    fitup = db.query(FitUpInspection).filter(FitUpInspection.id == final.fitup_id).first()
    if fitup:
        ndt.system_no = fitup.system_no
        ndt.line_no = fitup.line_no
        ndt.spool_no = fitup.spool_no
        ndt.joint_no = fitup.joint_no
        ndt.weld_type = fitup.weld_type
        if hasattr(fitup, 'weld_process'):
            ndt.weld_process = fitup.weld_process
        ndt.pipe_dia = getattr(fitup, 'dia', None)
    else:
        ndt.system_no = getattr(final, 'system_no', ndt.system_no)
        ndt.line_no = getattr(final, 'line_no', ndt.line_no)
        ndt.spool_no = getattr(final, 'spool_no', ndt.spool_no)
        ndt.joint_no = getattr(final, 'joint_no', ndt.joint_no)
        ndt.weld_type = getattr(final, 'weld_type', ndt.weld_type)
        ndt.pipe_dia = getattr(final, 'pipe_dia', getattr(ndt, 'pipe_dia', None))
    ndt.welder_no = final.welder_no
    ndt.weld_size = final.weld_length
    
    # Duplication guard by composite key
    existing_dup = db.query(NDTRequest).filter(
        NDTRequest.project_id == ndt.project_id,
        NDTRequest.system_no == ndt.system_no,
        NDTRequest.line_no == ndt.line_no,
        NDTRequest.spool_no == ndt.spool_no,
        NDTRequest.joint_no == ndt.joint_no,
        NDTRequest.ndt_type == ndt.ndt_type,
    ).first()
    if existing_dup:
        raise HTTPException(status_code=400, detail="Duplicate NDT request for joint and method")

    db_ndt = NDTRequest(**ndt.model_dump())
    db.add(db_ndt)
    db.commit()
    db.refresh(db_ndt)
    return db_ndt

@router.get("/ndt-status-records", response_model=List[NDTStatusRecordSchema])
def get_ndt_status_records(
    project_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    q = db.query(NDTStatusRecord).join(FinalInspection, FinalInspection.id == NDTStatusRecord.final_id)
    q = q.filter(NDTStatusRecord.project_id == project_id)
    q = q.filter(FinalInspection.final_result.ilike('accepted'))
    return q.all()

@router.put("/ndt-status-records/{record_id}", response_model=NDTStatusRecordSchema)
def update_ndt_status_record(
    record_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    rec = db.query(NDTStatusRecord).filter(NDTStatusRecord.id == record_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Record not found")
    project = db.query(ProjectModel).filter(ProjectModel.id == rec.project_id).first()
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    if (current_user.role or '').lower() == 'inspector':
        s = (rec.ndt_result or '').lower()
        if s == 'accepted':
            raise HTTPException(status_code=403, detail="Not authorized to edit accepted NDT status as inspector")
    allowed = {"welder_no", "weld_size", "weld_site", "ndt_type", "ndt_report_no", "ndt_result", "rejected_length"}
    incoming = (payload if isinstance(payload, dict) else payload.model_dump(exclude_unset=True))
    for k, v in incoming.items():
        if k in allowed:
            if k == "ndt_result" and isinstance(v, str):
                lv = v.strip().lower()
                if lv in ("accepted", "rejected"):
                    setattr(rec, k, lv)
                else:
                    setattr(rec, k, None)
            else:
                setattr(rec, k, v)
    db.commit()
    db.refresh(rec)

    # Synchronize NDT test entries with status updates
    update_data = payload if isinstance(payload, dict) else payload
    method = (update_data or {}).get("ndt_type") or rec.ndt_type
    if method:
        test = db.query(NDTTest).filter(NDTTest.final_id == rec.final_id, NDTTest.method == method).first()
        if not test:
            rv_create = (update_data or {}).get("ndt_result")
            rv_create = str(rv_create).strip().lower() if isinstance(rv_create, str) else None
            rv_create = rv_create if rv_create in ("accepted", "rejected") else None
            test = NDTTest(
                project_id=rec.project_id,
                final_id=rec.final_id,
                method=method,
                result=rv_create,
                report_no=(update_data or {}).get("ndt_report_no"),
                test_length=rec.weld_size,
            )
            db.add(test)
        else:
            if (update_data or {}).get("ndt_result") is not None:
                rv = str((update_data or {}).get("ndt_result")).strip().lower()
                test.result = rv if rv in ("accepted", "rejected") else None
            if (update_data or {}).get("ndt_report_no") is not None:
                test.report_no = (update_data or {}).get("ndt_report_no")
            # keep test_length aligned with weld_size if changed
            test.test_length = rec.weld_size
        db.commit()
        db.refresh(test)
        # Synchronize corresponding NDTRequest for (final_id, method)
        try:
            rv = (update_data or {}).get("ndt_result")
            if isinstance(rv, str):
                rv = rv.strip().lower()
                if rv not in ("accepted","rejected"):
                    rv = None
            req = db.query(NDTRequest).filter(NDTRequest.final_id == rec.final_id, NDTRequest.ndt_type == method).first()
            if req:
                if rv is not None:
                    req.ndt_result = rv
                rno = (update_data or {}).get("ndt_report_no")
                if rno is not None:
                    req.ndt_report_no = rno
                db.commit()
        except Exception:
            pass
    return rec

@router.delete("/ndt-status-records/{record_id}")
def delete_ndt_status_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_admin)
):
    rec = db.query(NDTStatusRecord).filter(NDTStatusRecord.id == record_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Record not found")
    project = db.query(ProjectModel).filter(ProjectModel.id == rec.project_id).first()
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    if rec.ndt_type:
        db.query(NDTTest).filter(NDTTest.final_id == rec.final_id, NDTTest.method == rec.ndt_type).delete()
    db.delete(rec)
    db.commit()
    return {"message": "NDT status record deleted"}

@router.post("/ndt-status-records/backfill")
def backfill_ndt_status_records(
    project_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_admin)
):
    finals = db.query(FinalInspection).filter(FinalInspection.project_id == project_id).all()
    created = 0
    for f in finals:
        exists = db.query(NDTStatusRecord).filter(NDTStatusRecord.final_id == f.id).first()
        if exists:
            continue
        fitup = db.query(FitUpInspection).filter(FitUpInspection.id == f.fitup_id).first()
        m = getattr(f, 'ndt_type', None)
        parts = [p.strip() for p in re.split(r"[,;/\s]+", m or "") if p.strip()]
        rec = NDTStatusRecord(
            project_id=f.project_id,
            final_id=f.id,
            system_no=(getattr(fitup, 'system_no', None) or getattr(f, 'system_no', None)),
            line_no=(getattr(fitup, 'line_no', None) or getattr(f, 'line_no', None)),
            spool_no=(getattr(fitup, 'spool_no', None) or getattr(f, 'spool_no', None)),
            joint_no=(getattr(fitup, 'joint_no', None) or getattr(f, 'joint_no', None)),
            weld_type=(getattr(fitup, 'weld_type', None) or getattr(f, 'weld_type', None)),
            welder_no=f.welder_no,
            weld_size=f.weld_length,
            rejected_length=0.0,
            weld_site=getattr(fitup, 'weld_site', None),
            pipe_dia=(getattr(fitup, 'dia', None) or getattr(f, 'pipe_dia', None)),
            ndt_type=(parts[0] if len(parts) == 1 else None),
        )
        db.add(rec)
        created += 1
    db.commit()
    return {"created": created}

@router.post("/ndt-status-records/ensure", response_model=NDTStatusRecordSchema)
def ensure_ndt_status_record(
    final_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    final = db.query(FinalInspection).filter(FinalInspection.id == final_id).first()
    if not final:
        raise HTTPException(status_code=404, detail="Final inspection not found")
    project = db.query(ProjectModel).filter(ProjectModel.id == final.project_id).first()
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    if (final.final_result or '').lower() != 'accepted':
        raise HTTPException(status_code=400, detail="Only accepted final inspections can be ensured")
    exists = db.query(NDTStatusRecord).filter(NDTStatusRecord.final_id == final.id).first()
    if exists:
        return exists
    fitup = db.query(FitUpInspection).filter(FitUpInspection.id == final.fitup_id).first()
    m = getattr(final, 'ndt_type', None)
    parts = [p.strip() for p in re.split(r"[,;/\s]+", m or "") if p.strip()]
    rec = NDTStatusRecord(
        project_id=final.project_id,
        final_id=final.id,
        system_no=(getattr(fitup, 'system_no', None) or getattr(final, 'system_no', None)),
        line_no=(getattr(fitup, 'line_no', None) or getattr(final, 'line_no', None)),
        spool_no=(getattr(fitup, 'spool_no', None) or getattr(final, 'spool_no', None)),
        joint_no=(getattr(fitup, 'joint_no', None) or getattr(final, 'joint_no', None)),
        weld_type=(getattr(fitup, 'weld_type', None) or getattr(final, 'weld_type', None)),
        welder_no=final.welder_no,
        weld_size=final.weld_length,
        rejected_length=0.0,
        weld_site=getattr(fitup, 'weld_site', None),
        pipe_dia=(getattr(fitup, 'dia', None) or getattr(final, 'pipe_dia', None)),
        ndt_type=(parts[0] if len(parts) == 1 else None),
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)
    return rec

@router.put("/ndt-requests/{ndt_id}/status")
def update_ndt_status(
    ndt_id: int,
    status_update: dict,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    ndt = db.query(NDTRequest).filter(NDTRequest.id == ndt_id).first()
    if not ndt:
        raise HTTPException(status_code=404, detail="NDT request not found")
    
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
        ndt.ndt_result = "to raise RFI"
    elif new_status == "RFI Raised":
        ndt.ndt_result = "to update"
    # For "RFI Raised" and "pending", don't change ndt_result
    
    db.commit()

    # Synchronize status/test when marking approved/rejected or RFI Raised
    try:
        if new_status in ("pending","RFI Raised") and ndt.final_id:
            rec = db.query(NDTStatusRecord).filter(NDTStatusRecord.final_id == ndt.final_id).first()
            final = db.query(FinalInspection).filter(FinalInspection.id == ndt.final_id).first()
            method = ndt.ndt_type
            
            # Set result based on status
            result = None
            if new_status == "RFI Raised":
                result = "to update"
            elif new_status == "pending":
                result = "to request"
            
            
            report_no = getattr(ndt, 'ndt_report_no', None) or getattr(rec, 'ndt_report_no', None)
            
            if not rec and final and (getattr(final, 'final_result', '') or '').lower() == 'accepted':
                fitup = db.query(FitUpInspection).filter(FitUpInspection.id == final.fitup_id).first()
                rec = NDTStatusRecord(
                    project_id=final.project_id,
                    final_id=final.id,
                    system_no=(getattr(fitup, 'system_no', None) or getattr(final, 'system_no', None)),
                    line_no=(getattr(fitup, 'line_no', None) or getattr(final, 'line_no', None)),
                    spool_no=(getattr(fitup, 'spool_no', None) or getattr(final, 'spool_no', None)),
                    joint_no=(getattr(fitup, 'joint_no', None) or getattr(final, 'joint_no', None)),
                    weld_type=(getattr(fitup, 'weld_type', None) or getattr(final, 'weld_type', None)),
                    welder_no=final.welder_no,
                    weld_size=ndt.weld_size or final.weld_length,
                    rejected_length=0.0,
                    weld_site=getattr(fitup, 'weld_site', None),
                    pipe_dia=(getattr(fitup, 'dia', None) or getattr(final, 'pipe_dia', None)),
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
                rec.weld_size = ndt.weld_size
                if getattr(ndt, 'welder_no', None):
                    rec.welder_no = ndt.welder_no
            
            if method:
                test = db.query(NDTTest).filter(NDTTest.final_id == ndt.final_id, NDTTest.method == method).first()
                if not test:
                    test = NDTTest(
                        project_id=ndt.project_id,
                        final_id=ndt.final_id,
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
    
    return {"message": f"NDT request status updated to {new_status}"}

@router.put("/ndt-requests/{ndt_id}", response_model=NDTRequestSchema)
def update_ndt_request(
    ndt_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    ndt = db.query(NDTRequest).filter(NDTRequest.id == ndt_id).first()
    if not ndt:
        raise HTTPException(status_code=404, detail="NDT request not found")
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
        final = db.query(FinalInspection).filter(FinalInspection.id == update_data['final_id']).first()
        if not final:
            raise HTTPException(status_code=404, detail="Final inspection not found")
        if final.project_id != ndt.project_id:
            raise HTTPException(status_code=400, detail="Final and NDT request must belong to the same project")
        if (final.final_result or '').lower() != 'accepted':
            raise HTTPException(status_code=400, detail="Only accepted final inspections can be linked")
        fitup = db.query(FitUpInspection).filter(FitUpInspection.id == final.fitup_id).first()
        if fitup:
            ndt.system_no = getattr(fitup, 'system_no', ndt.system_no)
            ndt.line_no = getattr(fitup, 'line_no', ndt.line_no)
            ndt.spool_no = getattr(fitup, 'spool_no', ndt.spool_no)
            ndt.joint_no = getattr(fitup, 'joint_no', ndt.joint_no)
            ndt.weld_type = getattr(fitup, 'weld_type', ndt.weld_type)
            ndt.weld_process = getattr(fitup, 'weld_process', ndt.weld_process)
        ndt.welder_no = getattr(final, 'welder_no', ndt.welder_no)
        ndt.weld_size = getattr(final, 'weld_length', ndt.weld_size)

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
            rec = db.query(NDTStatusRecord).filter(NDTStatusRecord.final_id == ndt.final_id).first()
            if rec:
                if method:
                    rec.ndt_type = method
                if report_no is not None:
                    rec.ndt_report_no = report_no
                rec.ndt_result = result
                rec.weld_size = ndt.weld_size
            # upsert NDTTest for (final_id, method)
            if method:
                test = db.query(NDTTest).filter(NDTTest.final_id == ndt.final_id, NDTTest.method == method).first()
                if not test:
                    test = NDTTest(
                        project_id=ndt.project_id,
                        final_id=ndt.final_id,
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

@router.delete("/ndt-requests/{ndt_id}")
def delete_ndt_request(
    ndt_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_admin)
):
    ndt = db.query(NDTRequest).filter(NDTRequest.id == ndt_id).first()
    if not ndt:
        raise HTTPException(status_code=404, detail="NDT request not found")
    project = db.query(ProjectModel).filter(ProjectModel.id == ndt.project_id).first()
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    before = _audit_snapshot(ndt)
    db.delete(ndt)
    db.commit()
    try:
        _audit("ndt_request", "delete", current_user, before=before, after=None, record_id=ndt.id, project_id=ndt.project_id)
    except Exception:
        pass
    return {"message": "NDT request deleted"}

@router.get("/ndt-tests", response_model=List[NDTTestSchema])
def get_ndt_tests(
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

@router.post("/ndt-tests", response_model=NDTTestSchema)
def create_ndt_test(
    payload: NDTTestCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_editor)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    final = db.query(FinalInspection).filter(FinalInspection.id == payload.final_id).first()
    if not final:
        raise HTTPException(status_code=404, detail="Final inspection not found")
    if final.project_id != payload.project_id:
        raise HTTPException(status_code=400, detail="Final and NDT test must belong to the same project")
    ndt = NDTTest(**payload.model_dump())
    db.add(ndt)
    db.commit()
    db.refresh(ndt)
    return ndt

@router.put("/ndt-tests/{test_id}", response_model=NDTTestSchema)
def update_ndt_test(
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
    for k, v in update_data.items():
        setattr(ndt, k, v)
    db.commit()
    db.refresh(ndt)
    return ndt

@router.delete("/ndt-tests/{test_id}")
def delete_ndt_test(
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

@router.get("/ndt-status", response_model=List[NDTStatusRecordSchema])
def get_ndt_status(
    project_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    q = db.query(NDTStatusRecord).join(FinalInspection, FinalInspection.id == NDTStatusRecord.final_id)
    q = q.filter(NDTStatusRecord.project_id == project_id)
    q = q.filter(FinalInspection.final_result.ilike('accepted'))
    return q.all()

# NDT Requirements Routes
@router.get("/ndt-requirements", response_model=List[dict])
def get_ndt_requirements(
    project_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    
    requirements = db.query(NDTRequirement).filter(NDTRequirement.project_id == project_id).all()
    return [{"method": req.method, "required": req.required} for req in requirements]

@router.post("/ndt-requirements", response_model=dict)
def create_ndt_requirement(
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

# WPS Register Routes

@router.get("/wps-register")
def get_wps_register(
    skip: int = 0,
    limit: int = 100,
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    query = db.query(WPSRegister)
    if project_id:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        if current_user.role != 'admin' and project not in current_user.assigned_projects:
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
    current_user: UserModel = Depends(require_editor)
):
    wps = db.query(WPSRegister).filter(WPSRegister.id == wps_id).first()
    if not wps:
        raise HTTPException(status_code=404, detail="WPS not found")
    project = db.query(ProjectModel).filter(ProjectModel.id == wps.project_id).first()
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    db.delete(wps)
    db.commit()
    return {"message": "WPS deleted successfully"}

# Welder Register Routes
@router.get("/welder-register")
def get_welder_register(
    skip: int = 0,
    limit: int = 100,
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    query = db.query(WelderRegister)
    if project_id:
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        if current_user.role != 'admin' and project not in current_user.assigned_projects:
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
            # add 6 months (approximate by month arithmetic)
            month = base.month + 6
            year = base.year + (month - 1) // 12
            month = ((month - 1) % 12) + 1
            day = min(base.day, [31,29 if year%4==0 and (year%100!=0 or year%400==0) else 28,31,30,31,30,31,31,30,31,30,31][month-1])
            new_date = datetime(year, month, day)
            payload['validity'] = f"{new_date.day:02d}/{new_date.month:02d}/{str(new_date.year)[-2:]}"
        # remove non-model field
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
    current_user: UserModel = Depends(require_editor)
):
    welder = db.query(WelderRegister).filter(WelderRegister.id == welder_id).first()
    if not welder:
        raise HTTPException(status_code=404, detail="Welder not found")
    project = db.query(ProjectModel).filter(ProjectModel.id == welder.project_id).first()
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    db.delete(welder)
    db.commit()
    return {"message": "Welder deleted successfully"}
