# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**MPDMS (Multi-Project Data Management System)** is an inspection/QA record system for fabrication projects. The active domain is **structure** projects (pipe tables exist as abstract bases but the concrete pipe models are not registered); data flows Material Register → Fit-up → Final Inspection → NDT Request/Status, with WPS and Welder registers and a project dashboard.

## Stack and entry points

- **Backend**: FastAPI + synchronous SQLAlchemy 2.x + Pydantic v2, Python 3.11+ (`backend/app/main.py` is the app).
- **Frontend**: React 18 + TypeScript + Create React App (`react-scripts`) + MUI 5, entry `frontend/src/App.tsx`.
- **DB**: SQLite by default (despite the README); PostgreSQL when `DB_TYPE` is not `sqlite`.
- **Auth**: JWT (HS256, 30 min) via `Authorization: Bearer`; roles `admin`, `inspector`, `visitor`.
- **AI**: DeepSeek-compatible chat API, optional; mock output when no key.
- **Deploy**: Docker Compose (`db`/`backend`/`frontend`/`nginx`) and a GitHub Actions workflow that syncs a build to a server.

## Commands

### Backend (run from `backend/`)

```powershell
# Local dev (system Python works: 3.13 is installed; the checked-in venv311 is often broken)
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# or the wrapper (supports dev flags)
..\scripts\start-backend.ps1 -Reload -UseSqlite -BypassLogin
```

Required/important env: `SECRET_KEY` (required when `ENVIRONMENT=production`), `ENVIRONMENT`, `DATABASE_URL`, `DB_TYPE=postgres` to leave SQLite, `ALLOW_ORIGINS`, `ALLOWED_HOSTS`, `DEFAULT_ADMIN_PASSWORD`, `DEEPSEEK_API_KEY`, `REDIS_URL`.

`DB_TYPE` defaults to `sqlite`, so the app ignores `DATABASE_URL` unless you set `DB_TYPE=postgres` (or another non-`sqlite` value).

```powershell
# Tests (pytest suite lives in backend/tests; uses a temp SQLite DB)
cd backend
python -m pytest tests -q
python -m pytest tests/test_authorization.py::test_name -q
```

### Frontend (run from `frontend/`)

```powershell
npm start                 # CRA dev server, port 5000 via .env
npm run build             # production bundle in frontend/build
npx tsc --noEmit          # typecheck
CI=true npm test -- --watchAll=false                 # all tests
CI=true npm test -- --watchAll=false -t "dashboard"  # single test by name
```

Tests are slow (~4 min) because CRA runs the full jest transform; run targeted tests while iterating.

### Docker

```powershell
docker compose up --build -d
docker compose logs -f backend
docker compose exec db psql -U postgres -d project_management
```

## Backend architecture

```
backend/app/
  main.py          app factory, middleware, startup DB bootstrap, /health /metrics
  database.py      engine + pooling + get_db dependency
  models.py        all ORM models (single file)
  schemas.py       all Pydantic DTOs (single file)
  auth.py          hashing, JWT, get_current_user + role dependencies
  cache.py         optional Redis with in-memory fallback
  routes/          auth, users, projects, structure_inspections, templates, ai, ndt_sync
  services/        ndt_sync_service (master-joint ↔ NDT status sync), backend_strategy_service
  utils/           NDT report-number validation, weld-length math
```

**Models**: abstract bases `MasterJointList`, `MaterialRegister`, `FitUpInspection`, `FinalInspection`, `NDTRequest`, `NDTStatusRecord` are subclassed by the concrete `Structure*` models (`structure_*` tables). `ProjectRelationMixin` supplies `project_id`; `TimestampMixin` supplies `created_at`/`updated_at`. `User.assigned_projects` is a many-to-many through `user_projects` and is declared `lazy="dynamic"` (it returns a query, not a list).

**Tenant isolation**: every project-scoped read must filter `project_id`, and every write must verify the caller is admin or assigned to that project. The existing pattern is `if current_user.role != 'admin' and project not in current_user.assigned_projects: raise 403`. New endpoints must repeat this check; several older write endpoints missed it (fixed in `structure_inspections.py` — keep the pattern when adding routes).

**Authorization dependencies**: `get_current_user` (any authenticated, active user), `require_editor` (admin/inspector), `require_admin`. Routes that mutate master-joint/NDT data use `require_editor`; user/project administration uses `require_admin`.

**Startup bootstrap** (`main.py`): `Base.metadata.create_all`, then runtime `ALTER TABLE` column additions listed in `COLUMN_MIGRATIONS` (SQLite only), default admin creation when `DEFAULT_ADMIN_PASSWORD` is set, index creation, timestamp backfill. There is **no Alembic migration history in use**; the scripts under `backend/scripts/migrations/` are one-off scripts.

**Audit**: `routes/structure_inspections.py::_audit` appends plain-text JSON-lines to `backend/logs/YYYY-MM-DD.log`; `/audit-logs/*` endpoints are admin-only.

**NDT sync**: `services/ndt_sync_service.py` copies completed NDT status/report data onto `structure_master_joint_list`. It is triggered on final/NDT-test writes via `_trigger_ndt_sync_by_final_id` and exposed under `/api/v1/ndt-sync/*`.

**AI assistant**: `/api/v1/ai/assistant/chat` runs a synchronous LangGraph graph (`services/assistant_graph.py`: retrieve → reason ⇄ tools → verify) scoped to the caller's project; tools are read-only (`search_records`, `scan_data_quality`, `get_project_summary`). Memory lives in `ai_conversations`/`ai_messages` (`services/ai_memory_service.py`), retrieval is lexical BM25 over project records (`services/rag_service.py`), and typo/mismatch checks are deterministic and advisory (`services/data_quality_service.py`, also exposed at `/ai/data-quality/{project_id}`). Without `DEEPSEEK_API_KEY` the assistant answers deterministically with `metrics.fallback=true`; upstream failures return 502. Key env knobs: `DEEPSEEK_API_KEY`, `DEEPSEEK_API_URL`, `DEEPSEEK_MODEL` (default `deepseek-flash`), `AI_ASSISTANT_ENABLED`, `AI_ASSISTANT_RATE_LIMIT`, `AI_MAX_TOOL_ROUNDS`, `AI_MAX_TOKENS_PER_REQUEST`, `AI_RAG_TOP_K`, `AI_RAG_CACHE_TTL`, `AI_SCAN_MAX_RECORDS`, `AI_FUZZY_THRESHOLD`, `AI_MEMORY_MAX_MESSAGES`, `AI_MEMORY_SUMMARY_THRESHOLD`, `AI_ALLOW_MOCK` (legacy `/ai/*` routes; set false in production). Offline eval: `python scripts/ai_eval.py --mode fake`.

## Frontend architecture

- `contexts/AuthContext.tsx` owns login/logout, token in `localStorage`, current user, and **selectedProject** (also persisted in `localStorage`). Route guards in `App.tsx` (`ProtectedRoute`, `ProjectRequiredRoute`, `AdminRoute`) are UX-only; the backend is the authority.
- `services/api.ts` is the single axios client (interceptors add the bearer token and redirect on 401) and exposes `ApiService` static methods. `services/apiClient.ts` is a duplicate and unused.
- Large screens live in `components/Inspection/*` (1k+ lines each) and call `ApiService` with `selectedProject.id`.
- All backend calls are under `/api/v1`; `REACT_APP_API_URL` overrides the base URL.

## Conventions and gotchas

- **SQLite vs Postgres**: SQLite is the default for local work and uses `StaticPool` + `check_same_thread=False`. PostgreSQL uses `QueuePool` and session-level timeouts. Some SQL (runtime `ALTER TABLE`, `PRAGMA`) is SQLite-only and silently skipped on Postgres.
- **SQLAlchemy 2.x**: use `conn.execute(text("SELECT 1"))` — passing a bare string to `execute()` raises. `check_database_health` had this bug; keep queries wrapped in `text()`.
- **List endpoint truncation**: most list routes default to `limit=100` (max 1000) and the frontend does not paginate. If a screen "loses" rows, check the endpoint default rather than the query.
- **`assigned_projects` is dynamic**: don't call `.some()`/length assumptions on it without materializing; prefer a direct `user_projects` query for authorization checks.
- **Reference documents** (`loop_engineering_pyramid_langgraph_solution.md`, `Maigret_LoopEngineering_LangGraph_Integration.md`, `spec_kit_enterprise.zip`, `.trae/documents/*`) are design/strategy inputs, not runtime code. The Maigret/OSINT blueprint is out of scope for this QA product.
- **README drift**: the README describes PostgreSQL as the primary DB, port 3000, and test locations that do not exist. Trust the code and this file first.
- **Docker**: `docker-compose.yml` expects `frontend/Dockerfile`, which is not checked in; the frontend is currently served via the dev server or the Vercel/static build path. Verify Docker frontend builds before relying on `docker compose up`.
- **Windows**: prefer `scripts/*.ps1`; `backend/venv311` may point at a missing interpreter, so use system Python or create a fresh venv.
- **Secrets**: `.env` files exist in the tree (`frontend/.env` contains a local API URL). Never add real keys; use environment variables in deployment.

## CI

`.github/workflows/deploy.yml` runs Python syntax checks, the pytest suite (`backend/tests`), the frontend build and typecheck, then jest, then rsyncs/deploys on `main`. A green CI run now means the suites actually passed (the old `|| echo` failures were removed).

## Working style for changes in this repo

- Keep project-scoped authorization on every new read/write endpoint.
- Add/extend a pytest test under `backend/tests/` for backend behavior changes; add or update the nearest `*.test.tsx` for frontend behavior.
- Verify with `python -m pytest backend/tests -q`, `npx tsc --noEmit`, and `CI=true npm test -- --watchAll=false`.
- Don't commit secrets, generated `*.db`, `node_modules`, `build`, or logs.
