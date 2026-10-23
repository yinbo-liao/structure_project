# MPDMS — Scope Analysis and Execution Plan

Status: Phase 1 complete and verified. Phases 2–4 are planned, not yet implemented.
Last updated: 2026-10-23

## 1. What this system is

MPDMS (Multi-Project Data Management System) records fabrication QA data for
structure work. The operational chain is:

```
Master Joint List → Material Register → Fit-up Inspection → Final Inspection → NDT Request → NDT Status/Report
```

Everything is scoped to a project, and users are scoped to projects through
`user_projects`. Roles are `admin`, `inspector`, `visitor`. The backend is
FastAPI + SQLAlchemy 2.x (synchronous) + Pydantic v2; the frontend is React 18
+ TypeScript + MUI. SQLite is the default runtime database; PostgreSQL is
supported through `DB_TYPE=postgres`.

The production risks that matter most, in order:

1. **Cross-project data leakage** — the product is multi-tenant by project, so
   an authorization gap is the highest-severity defect class.
2. **Schema drift** — there is no migration history; startup performs inline
   SQLite `ALTER TABLE` migrations.
3. **Unbounded list/aggregate queries** — list endpoints default to 100 rows
   and the frontend has no pagination.
4. **AI layer reliability** — external LLM calls without retries/timeouts and
   prompt-injection exposure through project data.
5. **CI that cannot fail** — the previous workflow swallowed test failures.

## 2. Assessment of the three reference documents

| Reference | Fit | Recommendation |
|---|---|---|
| `loop_engineering_pyramid_langgraph_solution.md` | Architecture-level match: FastAPI, verification loops, retries, bounded execution, cost control, observability | Adopt the *patterns* that fit a single FastAPI service: input sanitization, bounded retries, response caching, guardrails, verification pass. Do **not** introduce LangGraph/Postgres checkpointing/Redis semantic cache now — there is no multi-step agent orchestration to justify the operational cost. |
| `Maigret_LoopEngineering_LangGraph_Integration.md` | Poor fit | Do **not** integrate. Maigret is an OSINT username-enumeration tool; it has no role in fabrication QA, and running third-party OSINT collection against real people carries legal/privacy exposure. |
| `spec_kit_enterprise.zip` (`ai-enterprise-platform-spec.md`) | Aspirational, different stack | Extract process ideas only: spec-first development, explicit acceptance criteria, CI gates, observability. A stack rewrite (different framework/cloud assumptions) is not justified by this codebase. |

Net: the existing FastAPI + React architecture is appropriate for the product.
The valuable work is hardening, test coverage, and operational maturity — not
re-platforming.

## 3. Architecture summary

Backend (`backend/app/`):

- `main.py` — app wiring, startup bootstrap (`create_all`, column migrations,
  default admin, indexes), health/metrics/database-info endpoints, security
  headers, exception handlers.
- `auth.py` — JWT (HS256), `get_current_user`, `require_editor`,
  `require_admin`, project-access helpers.
- `models.py` — abstract inspection bases subclassed into `Structure*` tables;
  `user_projects` association table.
- `routes/` — `auth`, `users`, `projects`, `structure_inspections`, `ndt_sync`,
  `ai`, `templates`.
- `services/ndt_sync_service.py` — copies NDT status/report data into the
  master joint list.

Frontend (`frontend/src/`):

- `services/api.ts` — the single Axios client and API surface.
- `contexts/AuthContext.tsx` — session and selected project.
- `components/` — inspection tables, dashboard, admin screens.

## 4. Phase 1 — Security, reliability, correctness (DONE)

Implemented and verified:

- **Project isolation enforced on writes.** Added `user_can_access_project` /
  `ensure_project_access` and applied them to master-joint create/upload,
  material create/upload, fit-up create, final create, NDT request create,
  NDT test create, NDT requirement create and NDT status-record ensure.
- **NDT sync router locked down.** All project-scoped endpoints now check
  project assignment; the cross-project `GET /ndt-sync/status` is admin-only.
- **Cross-project link validation.** An NDT request can no longer reference a
  final inspection from a different project (HTTP 400).
- **Inactive users rejected.** Tokens issued before deactivation now fail with
  401.
- **Token TTL consistency.** `/token` and `/login` both use
  `ACCESS_TOKEN_EXPIRE_MINUTES`; expiry is timezone-aware.
- **Schema endpoint restricted.** `/database/info` is admin-only.
- **Baseline security headers.** `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`, optional HSTS.
- **AI layer hardening.** Input sanitization/length caps, message-count caps,
  untrusted-data wrapper around project context, timeouts, bounded retries
  with exponential backoff, 5-minute SHA-256 response cache, generic 502/500
  responses with internal-only logging.
- **AI endpoint crashes fixed.** Removed references to non-existent pipe
  model/relationships; project summary now uses aggregate queries.
- **Health check fixed.** SQLAlchemy 2.x requires `text("SELECT 1")`; pool
  statistics now degrade gracefully for `StaticPool` (SQLite).
- **Duplicate route removed.** The second `PUT /structure/final-inspection/
  bulk-update` definition was deleted (the retained one includes Master Joint
  auto-sync).
- **Dead code removed.** Deleted unused `frontend/src/services/apiClient.ts`.
- **Frontend test corrected.** Dashboard KPI labels now match the UI.
- **CI fixed.** Backend runs the real pytest suite; frontend typecheck and
  tests no longer swallow failures.

Verification (all passing):

```bash
cd backend && python -m pytest tests -q          # 27 passed
cd frontend && npx tsc --noEmit                  # clean
cd frontend && CI=true npm test -- --watchAll=false
```

## 5. Phase 2 — Performance and data lifecycle (NEXT)

1. **Pagination contract.** Add `{items, total, skip, limit}` responses to the
   high-volume list endpoints (master joints, materials, fit-up, final, NDT),
   then add table pagination in the frontend. Keep array responses for
   compatibility or version the endpoints.
2. **Query budget.** Add `selectinload`/joined loading where list endpoints
   serialize relationships (fit-up master joint, final fitup, users'
   assigned projects) to remove N+1 queries.
3. **Alembic.** Introduce real migration history and stop relying on startup
   `ALTER TABLE`. Bootstrap the initial revision from the current schema.
4. **PostgreSQL production baseline.** Add migrations plus integration tests
   against Postgres; keep SQLite only for local/test.
5. **Summary caching.** Cache project summaries for a short TTL (30–60 s) and
   invalidate on writes, or compute on a schedule.
6. **Index review.** Add indexes for the actual filter columns used by the
   frontend (joint status, inspection result, NDT status) after measuring.

## 6. Phase 3 — Observability and operations

- Structured JSON logs with request ID and user ID; propagate into audit logs.
- Prometheus metrics at `/metrics` (request latency/count/errors, DB pool,
  job durations) instead of the current static JSON snapshot.
- Docker healthchecks for backend, frontend and database; `depends_on:
  condition: service_healthy`.
- Backup/restore runbook for PostgreSQL and the JSON-lines audit logs.
- CI: PostgreSQL service container, coverage reporting, dependency scanning.

## 7. Phase 4 — AI layer maturity (beyond current hardening)

- Optional verification pass (CoVe-style) behind a config flag, only for
  generated summaries; do not add LangGraph unless multi-step tools appear.
- Cost budget per user/project and token accounting.
- Retrieval limited to the requesting user's projects (already enforced at the
  project-summary endpoint; keep this invariant for any new tools).
- Golden-set regression tests for mock and real provider modes.

## 8. Risks and constraints

- **Do not run Maigret** against staff or contractors; privacy/legal risk.
- Startup migrations are not transactional across the full set; new columns
  must stay additive and nullable.
- SQLite `StaticPool` + `check_same_thread=False` is safe only for local/test
  use; production must use PostgreSQL with a real pool.
- The checked-in `backend/venv311` is broken; use the system Python.
- No commit/push is performed without explicit confirmation.

## 9. Definition of done for the current iteration

- [x] Project isolation on every project-scoped write path.
- [x] Regression tests for auth, isolation, NDT sync, AI, headers.
- [x] CI runs tests and fails on failure.
- [x] Backend and frontend suites green.
- [ ] Pagination (Phase 2).
- [ ] Alembic migration baseline (Phase 2).
- [ ] Postgres integration tests (Phase 2/3).
