from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
import os
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from app.database import engine
from app.models import Base
from app.routes import auth, users, projects, inspections, ai

Base.metadata.create_all(bind=engine)
def _ensure_ndt_request_columns():
    if engine.dialect.name != 'sqlite':
        return
    with engine.connect() as conn:
        rows = conn.exec_driver_sql("PRAGMA table_info(ndt_requests)").fetchall()
        existing = [r[1] for r in rows]
        required = {
            'final_id': 'INTEGER',
            'system_no': 'TEXT',
            'line_no': 'TEXT',
            'spool_no': 'TEXT',
            'joint_no': 'TEXT',
            'weld_type': 'TEXT',
            'welder_no': 'TEXT',
            'weld_size': 'FLOAT',
            'weld_process': 'TEXT',
            'ndt_report_no': 'TEXT',
            'ndt_result': 'TEXT',
        }
        for col, typ in required.items():
            if col not in existing:
                conn.exec_driver_sql(f"ALTER TABLE ndt_requests ADD COLUMN {col} {typ}")

def _ensure_master_joint_list_columns():
    if engine.dialect.name != 'sqlite':
        return
    with engine.connect() as conn:
        rows = conn.exec_driver_sql("PRAGMA table_info(master_joint_list)").fetchall()
        existing = [r[1] for r in rows]
        if 'pipe_dia' not in existing:
            conn.exec_driver_sql("ALTER TABLE master_joint_list ADD COLUMN pipe_dia TEXT")
        if 'fit_up_report_no' not in existing:
            conn.exec_driver_sql("ALTER TABLE master_joint_list ADD COLUMN fit_up_report_no TEXT")

def _ensure_wps_register_columns():
    if engine.dialect.name != 'sqlite':
        return
    with engine.connect() as conn:
        rows = conn.exec_driver_sql("PRAGMA table_info(wps_register)").fetchall()
        existing = [r[1] for r in rows]
        if 'job_trade' not in existing:
            conn.exec_driver_sql("ALTER TABLE wps_register ADD COLUMN job_trade TEXT")
        if 'position' not in existing:
            conn.exec_driver_sql("ALTER TABLE wps_register ADD COLUMN position TEXT")

def _ensure_welder_register_columns():
    if engine.dialect.name != 'sqlite':
        return
    with engine.connect() as conn:
        rows = conn.exec_driver_sql("PRAGMA table_info(welder_register)").fetchall()
        existing = [r[1] for r in rows]
        if 'welder_name' not in existing:
            conn.exec_driver_sql("ALTER TABLE welder_register ADD COLUMN welder_name TEXT")
        if 'qualified_material' not in existing:
            conn.exec_driver_sql("ALTER TABLE welder_register ADD COLUMN qualified_material TEXT")
        if 'thickness_range' not in existing:
            conn.exec_driver_sql("ALTER TABLE welder_register ADD COLUMN thickness_range TEXT")
        if 'weld_process' not in existing:
            conn.exec_driver_sql("ALTER TABLE welder_register ADD COLUMN weld_process TEXT")
        if 'qualified_position' not in existing:
            conn.exec_driver_sql("ALTER TABLE welder_register ADD COLUMN qualified_position TEXT")

def _ensure_final_inspection_columns():
    if engine.dialect.name != 'sqlite':
        return
    with engine.connect() as conn:
        rows = conn.exec_driver_sql("PRAGMA table_info(final_inspection)").fetchall()
        existing = [r[1] for r in rows]
        if 'welder_validity' not in existing:
            conn.exec_driver_sql("ALTER TABLE final_inspection ADD COLUMN welder_validity TEXT")

def _ensure_fitup_inspection_columns():
    if engine.dialect.name != 'sqlite':
        return
    with engine.connect() as conn:
        rows = conn.exec_driver_sql("PRAGMA table_info(fitup_inspection)").fetchall()
        existing = [r[1] for r in rows]
        if 'updated_by' not in existing:
            conn.exec_driver_sql("ALTER TABLE fitup_inspection ADD COLUMN updated_by TEXT")

def _ensure_ndt_request_unique_index():
    if engine.dialect.name != 'sqlite':
        return
    with engine.connect() as conn:
        idx = conn.exec_driver_sql("PRAGMA index_list(ndt_requests)").fetchall()
        names = [r[1] for r in idx]
        if 'uq_ndt_joint_method' not in names:
            conn.exec_driver_sql(
                "CREATE UNIQUE INDEX uq_ndt_joint_method ON ndt_requests(project_id, system_no, line_no, spool_no, joint_no, ndt_type)"
            )
_ensure_ndt_request_columns()
_ensure_master_joint_list_columns()
_ensure_wps_register_columns()
_ensure_welder_register_columns()
_ensure_final_inspection_columns()
_ensure_fitup_inspection_columns()
_ensure_ndt_request_unique_index()

def _ensure_ndt_status_columns():
    if engine.dialect.name != 'sqlite':
        return
    with engine.connect() as conn:
        rows = conn.exec_driver_sql("PRAGMA table_info(ndt_status_records)").fetchall()
        existing = [r[1] for r in rows]
        if 'rejected_length' not in existing:
            conn.exec_driver_sql("ALTER TABLE ndt_status_records ADD COLUMN rejected_length FLOAT")

_ensure_ndt_status_columns()

def _ensure_ndt_status_unique_index():
    if engine.dialect.name != 'sqlite':
        return
    with engine.connect() as conn:
        idx = conn.exec_driver_sql("PRAGMA index_list(ndt_status_records)").fetchall()
        names = [r[1] for r in idx]
        if 'uq_ndt_status_joint_method' not in names:
            try:
                conn.exec_driver_sql(
                    "CREATE UNIQUE INDEX uq_ndt_status_joint_method ON ndt_status_records(project_id, system_no, line_no, spool_no, joint_no, ndt_type)"
                )
            except Exception:
                # Deduplicate existing rows by keeping the lowest id per joint+method key
                dup_rows = conn.exec_driver_sql(
                    "SELECT project_id, system_no, line_no, spool_no, joint_no, ndt_type, COUNT(*) AS c FROM ndt_status_records GROUP BY project_id, system_no, line_no, spool_no, joint_no, ndt_type HAVING c > 1"
                ).fetchall()
                for prj, sysn, linen, spooln, jointn, method, _ in dup_rows:
                    ids = conn.exec_driver_sql(
                        "SELECT id FROM ndt_status_records WHERE project_id = ? AND system_no = ? AND line_no = ? AND spool_no = ? AND joint_no = ? AND ndt_type = ? ORDER BY id",
                        (prj, sysn or '', linen or '', spooln or '', jointn or '', method or '')
                    ).fetchall()
                    keep = ids[0][0] if ids else None
                    for row in ids[1:]:
                        conn.exec_driver_sql("DELETE FROM ndt_status_records WHERE id = ?", (row[0],))
                # Retry unique index creation
                conn.exec_driver_sql(
                    "CREATE UNIQUE INDEX uq_ndt_status_joint_method ON ndt_status_records(project_id, system_no, line_no, spool_no, joint_no, ndt_type)"
                )
        if 'ix_ndt_status_method' not in names:
            conn.exec_driver_sql(
                "CREATE INDEX ix_ndt_status_method ON ndt_status_records(ndt_type)"
            )
        if 'ix_ndt_status_project_method' not in names:
            conn.exec_driver_sql(
                "CREATE INDEX ix_ndt_status_project_method ON ndt_status_records(project_id, ndt_type)"
            )

_ensure_ndt_status_unique_index()

# Initialize FastAPI app
app = FastAPI(
    title="Multi-Project Data Management System",
    description="A comprehensive system for managing inspection records across multiple projects",
    version="3.0.0"
)

# CORS middleware
origins_env = os.getenv("ALLOW_ORIGINS")
allow_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001"
]
if origins_env:
    try:
        allow_origins = [o.strip() for o in origins_env.split(",") if o.strip()]
    except Exception:
        pass

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Trusted host middleware for security
hosts_env = os.getenv("ALLOWED_HOSTS")
allowed_hosts = ["*"]
if hosts_env:
    try:
        allowed_hosts = [h.strip() for h in hosts_env.split(",") if h.strip()]
    except Exception:
        pass
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=allowed_hosts
)

# Include routers
app.include_router(auth.router, prefix="/api/v1", tags=["Authentication"])
app.include_router(users.router, prefix="/api/v1", tags=["Users"])
app.include_router(projects.router, prefix="/api/v1", tags=["Projects"])
app.include_router(inspections.router, prefix="/api/v1", tags=["Inspections"])
app.include_router(ai.router, prefix="/api/v1", tags=["AI Services"])

@app.get("/")
async def root():
    return {
        "message": "Multi-Project Data Management System API",
        "version": "3.0.0",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    from datetime import datetime
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)