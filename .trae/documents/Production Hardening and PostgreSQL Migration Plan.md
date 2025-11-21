## Database Migration to PostgreSQL
- Install PostgreSQL and create DB/user with least-privilege grants
- Add `psycopg2-binary` to backend venv and set `DATABASE_URL` + `USE_SQLITE=false`
- Introduce Alembic for schema migrations (initial autogenerate, then curated migrations)
- Write a migration script to move data from SQLite to PostgreSQL (preserve IDs/relationships)

## Model Constraints & Indexes
- Add `UniqueConstraint` for composite keys used as uniqueness (e.g., `(project_id, system_no, line_no, spool_no, joint_no, ndt_type)` on NDT Status/Request)
- Add `Index`es on frequently filtered columns (e.g., `project_id`, `ndt_type`, dates)
- Remove runtime `ALTER TABLE` code paths; replace with Alembic migrations

## API Pagination & Validation
- Add `skip`/`limit` (with sensible caps) to all list endpoints: Fit-up, Final, NDT Requests, NDT Tests, Material Register/Inspection, Master Joint List
- Ensure consistent filtering parameters and ordering; return total counts where helpful
- Tighten Pydantic schemas: enums for statuses (`pending|accepted|rejected`), numeric ranges, date parsing, and immutable field protection for update endpoints

## Frontend Performance & UX
- Switch large tables to virtualization (e.g., MUI DataGrid or react-window) to keep UI responsive
- Integrate server-side pagination and filters; add loading states and robust error messages
- Lazy-load heavy routes/components; ensure `REACT_APP_API_URL` is environment-driven

## Deployment & Configuration
- Create Dockerfiles for backend (FastAPI with Gunicorn/Uvicorn workers) and frontend (static build)
- Provide Nginx reverse proxy config with TLS (Let’s Encrypt), proxy `/api/v1` to backend, serve frontend from `build/`
- Use environment-based `ALLOW_ORIGINS` and `ALLOWED_HOSTS`; configure JWT secret and other secrets via env/secret manager

## Observability & Operations
- Structured JSON logs with request IDs and correlation IDs; rotate/ship logs
- Prometheus metrics for request counts/latency/DB timings; Grafana dashboards and alerts
- Error tracking (Sentry) wired into backend and frontend
- Backups: Postgres (WAL archiving or nightly dumps) and object storage; documented restore procedure

## Security Hardening
- Disable `TEST_LOGIN_BYPASS` in production; enforce password policies; short-lived JWT with refresh flow
- Review RBAC and admin-only endpoints (e.g., audit logs); add rate limiting on write endpoints
- CORS/host restrictions enabled via env; firewall only necessary ports

## Rollout & Testing
- Load testing scripts (k6/Locust) simulating 1,000 users and large project datasets
- Canary rollout with monitoring thresholds; staged migration from SQLite to PostgreSQL

## Deliverables
- Alembic migrations (constraints/indexes) and SQLite→Postgres migration script
- Backend changes: pagination, validation, constraints, logging/metrics integration
- Frontend changes: pagination/virtualized tables, lazy-loading, improved error handling
- Containerization and Nginx/TLS configs; ops runbooks for backups/alerts

Please confirm, and I will begin implementing these changes step-by-step, validating each stage (builds, endpoints, and load tests).