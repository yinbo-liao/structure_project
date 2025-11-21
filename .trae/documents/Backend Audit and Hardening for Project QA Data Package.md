## Goals
- Multi-tenant project isolation with admin-driven project creation and user assignment
- Robust RBAC (Admin, Inspector, Visitor) with edit vs review modes
- Comprehensive summaries (materials, fit-up, final, NDT) and AI-assisted insights
- PostgreSQL-backed persistence with indexing and uniqueness
- Production-ready deployment (Docker + Nginx)

## Backend Changes (FastAPI + SQLAlchemy)
### Data Model Enhancements
- Unify SQLAlchemy Base across app; migrate to PostgreSQL via `DATABASE_URL`
- Add uniqueness and indexes:
  - `MaterialRegister`: unique `(project_id, piece_mark_no)`; index `piece_mark_no`
  - `MasterJointList`: unique `(project_id, draw_no, system_no, line_no, spool_no, joint_no)`
  - `FitUpInspection`, `FinalInspection`, `NDTRequest`: index `project_id`; validate cross-entity links belong to same project
- Add modules:
  - `WPSRegister`: `project_id`, `wps_no`, process, status fields
  - `WelderRegister`: `project_id`, `welder_no`, qualification, status fields

### RBAC & Auth
- Enforce JWT with `SECRET_KEY` from env, short token TTL
- Remove test-login bypass; dependencies:
  - `require_admin` for user/project administration
  - `require_editor` (admin/inspector) for create/update/delete in inspection modules
  - Visitors limited to GET (review mode)

### Project Isolation
- Scope all queries by `project_id` and authorized access (admin sees all; others only assigned projects)
- Admin endpoints:
  - Create/delete projects
  - Create/update/delete users
  - Assign projects to users

### Inspection Workflow APIs
- Material Register CRUD (editor only); lookup by unique piece mark scoped to project
- Master Joint List CRUD + CSV/XLSX upload with size/MIME validation; upsert by unique key
- Fit-up CRUD with auto-population of material details and validations
- Final CRUD ensuring fitup belongs to same project
- NDT requests CRUD + status updates; filter by project and status

### Reporting & Summary
- `/projects/{id}/summary`: counts for totals, done, outstanding across:
  - Materials (registered, pending inspection, inspected, rejected)
  - Fit-up (done vs outstanding from Master Joint List)
  - Final (done vs outstanding from Fit-up)
  - NDT (performed vs outstanding from Final accepted welds)
- Per-method NDT success rates (MP/PT/RT/UT/PAUT); weld length stats

### AI Integration
- Configurable provider via env (`AI_PROVIDER_URL`, `AI_MODEL`, `API_KEY`); robust fallback when key missing
- Summaries only when data completeness satisfied; feed aggregated context to AI

### Quality & Ops
- Structured logging (structlog) for requests/errors
- Health endpoint with dynamic timestamp and DB connectivity check
- Alembic migrations for indexes/constraints; seed users with hashed passwords

## Frontend Changes (React + TypeScript + MUI)
- AuthContext with role-derived capabilities (`canEdit`, `isAdmin`); project selection UI
- Dashboard:
  - Show only assigned projects for non-admin; global edit/review toggle (edit allowed for admin/inspector)
  - Summary cards for materials/fit-up/final/NDT; success rates and weld length charts
- Modules:
  - Material Register, Master Joint List, Fit-up, Final, NDT screens with table + form
  - Edit actions hidden/disabled in review mode; confirm dialogs for destructive actions
  - Auto material lookup by piece mark within selected project
- Admin screens:
  - User Management (create/update/delete; assign projects)
  - Project Management (create/update/delete)

## Deployment
- Docker Compose: FastAPI, Postgres, Nginx (serving frontend; proxy to backend)
- Backend container without `--reload`; configure workers/timeouts via env
- CORS and Trusted Hosts driven by env; secure defaults

## Testing & Validation
- Pytest suites: auth (token/RBAC), project isolation, inspection CRUD, summary math, file upload validations, AI fallback
- Seed/dev fixtures; run E2E smoke with frontend actions in review/edit modes

## Deliverables
- Updated backend models, routers, auth, and migrations
- Updated frontend components, services, contexts, and pages
- Docker/Nginx configs and env samples (no secrets)
- Test suites and seed scripts

Confirm to proceed and I will implement the code changes end-to-end, validate locally, and share the updated files.