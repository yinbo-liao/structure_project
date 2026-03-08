"""
Updated models.py with NDT columns for StructureMasterJointList
This is a simplified version that just adds the NDT columns to the existing model.
"""

# First, let me create a simple script to update the models.py file
import os
import re

def update_models_file():
    """Update the models.py file to add NDT columns to StructureMasterJointList"""
    models_path = os.path.join(os.path.dirname(__file__), 'models.py')
    
    with open(models_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find the StructureMasterJointList class
    pattern = r'(class StructureMasterJointList\(MasterJointList\):\s*\n\s*__tablename__ = "structure_master_joint_list"\s*\n\s*# Structure-specific fields\s*\n(?:.*?\n)*?\s*__table_args__ = \()'
    
    # Replacement with NDT columns
    replacement = '''class StructureMasterJointList(MasterJointList):
    __tablename__ = "structure_master_joint_list"
    
    # Structure-specific fields
    block_no = Column(String(50))
    draw_no = Column(String(50), nullable=False)
    structure_category = Column(String(50), nullable=False)
    page_no = Column(String(50), nullable=False)
    drawing_rev = Column(String(20), nullable=False)
    thickness = Column(String(20))
    
    # NDT Testing Columns for each method
    ndt_rt_report_no = Column(String(100))
    ndt_rt_result = Column(String(20))
    ndt_ut_report_no = Column(String(100))
    ndt_ut_result = Column(String(20))
    ndt_mpi_report_no = Column(String(100))
    ndt_mpi_result = Column(String(20))
    ndt_pt_report_no = Column(String(100))
    ndt_pt_result = Column(String(20))
    ndt_pmi_report_no = Column(String(100))
    ndt_pmi_result = Column(String(20))
    ndt_ft_report_no = Column(String(100))
    ndt_ft_result = Column(String(20))
    
    # Comprehensive NDT Status
    ndt_comprehensive_status = Column(String(50))
    ndt_last_sync = Column(DateTime(timezone=True))
    ndt_sync_status = Column(String(20))
    
    __table_args__ = ('''
    
    # Update the content
    updated_content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    
    # Also need to update the indexes in __table_args__
    indexes_pattern = r'(__table_args__ = \(\s*UniqueConstraint\(\s*\'project_id\', \'draw_no\', \'structure_category\', \'page_no\', \'drawing_rev\', \'joint_no\',\s*name=create_unique_constraint_name\(__tablename__, \'project\', \'draw\', \'category\', \'page\', \'rev\', \'joint\'\)\s*\),\s*Index\(create_unique_index_name\(__tablename__, \'block_no\'\), \'block_no\'\),\s*Index\(create_unique_index_name\(__tablename__, \'draw_no\', \'page_no\'\), \'draw_no\', \'page_no\'\),\s*Index\(create_unique_index_name\(__tablename__, \'structure_category\'\), \'structure_category\'\),\s*\))'
    
    indexes_replacement = '''__table_args__ = (
        UniqueConstraint(
            'project_id', 'draw_no', 'structure_category', 'page_no', 'drawing_rev', 'joint_no',
            name=create_unique_constraint_name(__tablename__, 'project', 'draw', 'category', 'page', 'rev', 'joint')
        ),
        Index(create_unique_index_name(__tablename__, 'block_no'), 'block_no'),
        Index(create_unique_index_name(__tablename__, 'draw_no', 'page_no'), 'draw_no', 'page_no'),
        Index(create_unique_index_name(__tablename__, 'structure_category'), 'structure_category'),
        Index(create_unique_index_name(__tablename__, 'ndt_comprehensive_status'), 'ndt_comprehensive_status'),
        Index(create_unique_index_name(__tablename__, 'ndt_last_sync'), 'ndt_last_sync'),
        Index(create_unique_index_name(__tablename__, 'ndt_sync_status'), 'ndt_sync_status'),
    )'''
    
    updated_content = re.sub(indexes_pattern, indexes_replacement, updated_content, flags=re.DOTALL)
    
    # Write the updated content
    with open(models_path, 'w', encoding='utf-8') as f:
        f.write(updated_content)
    
    print(f"Updated {models_path} with NDT columns")
    
    # Verify the update
    with open(models_path, 'r', encoding='utf-8') as f:
        updated = f.read()
        if 'ndt_rt_report_no' in updated and 'ndt_comprehensive_status' in updated:
            print("Successfully added NDT columns to StructureMasterJointList")
        else:
            print("Failed to add NDT columns")

if __name__ == "__main__":
    update_models_file()