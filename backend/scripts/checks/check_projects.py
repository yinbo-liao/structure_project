from app.database import SessionLocal
from app.models import Project

db = SessionLocal()
try:
    projects = db.query(Project).all()
    print('Projects:')
    for p in projects:
        print(f'  - {p.name} ({p.code}): {p.project_type}')
finally:
    db.close()
