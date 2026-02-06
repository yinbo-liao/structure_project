# Scripts Organization

This directory contains organized scripts for the Project QA Data Package backend.

## Directory Structure

```
backend/scripts/
├── migrations/    # Database migration scripts
├── checks/       # Reusable validation and verification scripts
└── utilities/    # One-time cleanup and debugging scripts
```

## Migration Scripts (`migrations/`)

These scripts define database schema changes and should be version controlled.

### Key Migration Scripts:
- `migrate_separate_tables.py` - Separates pipe and structure tables
- `migrate_to_structure_tables.py` - Creates structure-specific tables
- `migrate_project_type.py` - Adds project_type column to projects table
- `migrate_inspection_category.py` - Updates inspection categories
- `migrate_ndt_validation.py` - NDT validation updates
- `migrate_block_no.py` - Block number field updates
- `migrate_draw_no.py` - Drawing number field updates
- `migrate_material_structure_fields.py` - Material structure field updates
- `migrate_password_change_field.py` - Password change field updates
- `migrate_material_report_no.py` - Material report number updates
- `migrate_ndt_request.py` - NDT request table updates
- `migrate_ndt_rejected_length.py` - NDT rejected length updates
- `migrate_wps_pipe_dia.py` - WPS pipe diameter updates
- `migrate_weld_length.py` - Weld length calculation updates
- `migrate_inspection_category_special.py` - Special inspection category updates
- `migrate_old_ndt_requests.py` - Legacy NDT request migration

### Usage:
```bash
cd backend
python scripts/migrations/migrate_separate_tables.py
```

## Check Scripts (`checks/`)

Reusable scripts for validation and verification. These are kept in version control.

### Available Checks:
- `check_endpoints.py` - Verify API endpoints are working
- `check_projects.py` - Validate project data integrity
- `check_db.py` - Basic database connectivity check
- `check_users.py` - User data validation

### Usage:
```bash
cd backend
python scripts/checks/check_endpoints.py
```

## Utility Scripts (`utilities/`)

One-time cleanup, debugging, or temporary scripts. These are typically excluded from version control via `.gitignore`.

### Examples:
- `check_ndt_tables.py` - Debug NDT table issues
- `check_project_db.py` - Project database analysis
- `check_tables.py`, `check_tables_simple.py` - Table validation
- `check_db_tables.py`, `check_db_tables_simple.py` - Database table checks
- `check_project_type.py` - Project type validation
- `check_backend_db.py` - Backend database verification
- `check_all_columns.py` - Column validation
- `check_ndt_status_columns.py`, `check_ndt_status_data.py` - NDT status checks
- `check_db_schema.py` - Database schema verification
- `check_tables_again.py` - Additional table validation

## Git Ignore Rules

The `.gitignore` file has been configured with these rules:

```git
# Temporary check scripts (keep organized scripts in backend/scripts/)
check_*.py
!backend/scripts/checks/check_*.py
!backend/scripts/migrations/migrate_*.py
```

This configuration:
1. **Excludes** `check_*.py` files in the root directory
2. **Includes** organized scripts in `backend/scripts/checks/`
3. **Includes** migration scripts in `backend/scripts/migrations/`

## Best Practices

### 1. **New Migration Scripts:**
- Place in `migrations/` directory
- Use descriptive names: `migrate_[feature]_[purpose].py`
- Include comments explaining the migration purpose
- Test before running on production data

### 2. **Reusable Check Scripts:**
- Place in `checks/` directory
- Make them idempotent (safe to run multiple times)
- Include error handling and clear output messages
- Document usage in this file

### 3. **Temporary/Debug Scripts:**
- Place in `utilities/` directory
- Consider adding date prefix: `2026-01-20_check_ndt_tables.py`
- Document purpose in script comments
- Remove when no longer needed

### 4. **Script Development:**
- Test scripts in development environment first
- Use relative imports for project modules
- Handle database connections properly (close connections)
- Include logging for debugging

### 5. **Version Control:**
- Migration scripts should always be version controlled
- Reusable check scripts should be version controlled
- Temporary utilities can be excluded via `.gitignore`
- Update this documentation when adding significant scripts

## Recent Changes (2026-01-20)

### Reorganization:
- Organized all `migrate_*.py` scripts into `scripts/migrations/`
- Moved reusable check scripts to `scripts/checks/`
- Consolidated temporary/debug scripts in `scripts/utilities/`
- Updated `.gitignore` to exclude temporary check scripts while keeping organized structure

### Benefits:
1. **Clear separation** between schema changes, reusable tools, and temporary scripts
2. **Better version control** - important scripts are tracked, temporary ones are not
3. **Easier maintenance** - scripts are organized by purpose
4. **Improved onboarding** - new developers can understand script purposes

## Testing the Setup

To verify the git ignore rules work correctly:

```bash
# Check what would be committed
git status --ignored

# Test that check scripts in root are ignored
touch test_check_script.py
git status  # Should show as untracked

# Test that organized scripts are tracked
cd backend/scripts/checks/
touch new_check_script.py
git status  # Should show as new file to be tracked
```

## Adding New Scripts

1. **Determine script type:**
   - Schema change? → `migrations/`
   - Reusable validation? → `checks/`
   - One-time debug? → `utilities/`

2. **Follow naming conventions:**
   - Migrations: `migrate_[feature]_[purpose].py`
   - Checks: `check_[what]_[purpose].py`
   - Utilities: `[date]_[purpose].py` or descriptive name

3. **Update documentation if needed**

4. **Test thoroughly before use**
