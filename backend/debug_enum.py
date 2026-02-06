import sys
import os

# Add current directory to path
sys.path.append(os.getcwd())

from app.models import ProjectType as ModelProjectType
from app.schemas import ProjectType as SchemaProjectType
from app.models_fixed import ProjectType as FixedProjectType

print(f"ModelProjectType: {list(ModelProjectType)}")
print(f"ModelProjectType.PIPE.value: '{ModelProjectType.PIPE.value}'")
print(f"ModelProjectType.STRUCTURE.value: '{ModelProjectType.STRUCTURE.value}'")

print(f"SchemaProjectType: {list(SchemaProjectType)}")
print(f"SchemaProjectType.PIPE.value: '{SchemaProjectType.PIPE.value}'")

print(f"FixedProjectType: {list(FixedProjectType)}")
print(f"FixedProjectType.PIPE.value: '{FixedProjectType.PIPE.value}'")

# Check if 'pipe' is valid
try:
    print(f"ModelProjectType('pipe'): {ModelProjectType('pipe')}")
except Exception as e:
    print(f"ModelProjectType('pipe') failed: {e}")

try:
    print(f"ModelProjectType('PIPE'): {ModelProjectType('PIPE')}")
except Exception as e:
    print(f"ModelProjectType('PIPE') failed: {e}")
