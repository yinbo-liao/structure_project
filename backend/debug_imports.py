
import sys
import os
from sqlalchemy.orm import class_mapper

# Add current directory to path
sys.path.append(os.getcwd())

print("DEBUG: Importing app.models...")
try:
    from app.models import Project, ProjectType
    print(f"Project imported. ProjectType imported: {ProjectType}")
except ImportError:
    from app.models import Project
    print("Project imported. ProjectType NOT found in app.models (Good)")

print(f"Project.project_type column type: {Project.project_type.type}")

print("DEBUG: Importing app.models_fixed...")
try:
    from app.models_fixed import Project as ProjectFixed, ProjectType as ProjectTypeFixed
    print(f"ProjectFixed imported. ProjectTypeFixed imported: {ProjectTypeFixed}")
except ImportError:
    from app.models_fixed import Project as ProjectFixed
    print("ProjectFixed imported. ProjectTypeFixed NOT found in app.models_fixed (Good)")

print(f"ProjectFixed.project_type column type: {ProjectFixed.project_type.type}")

print("DEBUG: Importing app.schemas...")
try:
    from app.schemas import ProjectFields, ProjectType as ProjectTypeSchema
    print(f"ProjectFields imported. ProjectTypeSchema imported: {ProjectTypeSchema}")
except ImportError:
    from app.schemas import ProjectFields
    print("ProjectFields imported. ProjectTypeSchema NOT found in app.schemas (Good)")

print(f"ProjectFields.project_type field: {ProjectFields.model_fields['project_type']}")

print("DEBUG: Inspecting Project relationships...")
mapper = class_mapper(Project)
for rel in mapper.relationships:
    print(f"Relationship: {rel.key} -> {rel.mapper.class_}")

print("Done.")
