
import sys
import os

# Add the current directory to sys.path
sys.path.append(os.getcwd())

from app.models import Project
from sqlalchemy import inspection

print(f"Project.project_type type: {Project.project_type.type}")
print(f"Project.project_type expression: {Project.project_type.expression}")

from app.models_fixed import Project as ProjectFixed
print(f"ProjectFixed.project_type type: {ProjectFixed.project_type.type}")
