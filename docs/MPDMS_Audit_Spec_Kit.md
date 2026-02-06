# MPDMS Audit Spec Kit
Version 3.0 • Date: 2026-01-25

## Cover
- Organization: Multi-Project Data Management System (MPDMS)
- System Type: Fabrication Inspection Management (Pipe & Structure)
- Contacts: Product Owner, Lead Engineer, Security Officer
- Document Classification: Internal Audit — Technical & Compliance Specification

## 1. Purpose & Scope
- Establish auditable specifications for managing inspection records: Master Joint List, Fit-up, Final, Material Register, WPS, Welder, NDT requests/status/tests
- Apply across pipe and structure projects with unified governance, data integrity, and access control
- Define compliance sections: data retention, backup/restore, change management, incident response, security, privacy

## 2. System Overview
- Frontend: React 18 + MUI 5; routes in [App.tsx](../frontend/src/App.tsx), API client in [api.ts](../frontend/src/services/api.ts)
- Backend: FastAPI, SQLAlchemy ORM; app bootstrap in [main.py](../backend/app/main.py), models in [models.py](../backend/app/models.py)
- Pipe routes: [pipe_inspections.py](../backend/app/routes/pipe_inspections.py), Structure routes: [structure_inspections.py](../backend/app/routes/structure_inspections.py)
- Dev DB: SQLite with runtime migrations ensuring required columns and unique indices

## 3. Domain Model (Pipe Focus)
- Master Joint List
  - Key fields: project_id, system_no, line_no, spool_no, joint_no
  - Uniqueness: composite (project_id, system_no, line_no, spool_no, joint_no)
- Fit-up Inspection
  - Key fields: project_id, system_no, line_no, spool_no, joint_no, weld_type, dia, fit_up_result, updated_by
  - Auto calculations: weld_length from dia
  - Uniqueness: composite key same as above
- Final Inspection
  - Key fields: project_id, system_no, line_no, spool_no, joint_no, weld_type, welder_no, wps_no, final_result, ndt_type
  - Auto-fill: missing identifiers from linked fit-up on update
  - Uniqueness: composite key same as above
- Material Register
  - Fields: piece_mark_no, material_type, grade, thickness, pipe_spec, pipe_category, schedule, drawing_no, pipe_dia
  - Upload: CSV/Excel mapping with synonyms; validation and size limits

## 4. Architecture & Data Flow
- Lifecycle per joint (pipe):
  1. Master Joint defined
  2. Fit-up recorded (materials, site, result); optional auto-length
  3. Final recorded (welder/WPS, result); ndt_type may be multi-valued
  4. NDT request/status/test created based on accepted final and request presence
- NDT status derives from Final acceptance plus existing NDT request; records linked for reporting
- Frontend guards prevent duplicate joint submissions; backend enforces uniqueness and returns 400 on conflict

## 5. Access Control & Roles
- Roles: admin, inspector, visitor
- Admin: full read/write; management endpoints; audit logs
- Inspector: create/update inspection records within assigned projects; restricted edits for accepted finals (configurable)
- Visitor: read-only access within assigned projects
- Enforcement: route-level checks (403 on unauthorized), token-based auth via JWT

## 6. Data Integrity & Uniqueness
- Composite unique constraints:
  - Pipe Fit-up & Final: (project_id, system_no, line_no, spool_no, joint_no)
  - Implemented via ORM UniqueConstraint and SQLite startup unique indexes
- Duplicate guards:
  - Create/update endpoints pre-check duplicates and return 400 with descriptive messages
- Auto-fill logic:
  - On final update, missing identifiers are filled from linked fit-up; blanks normalized to None

## 7. Error Handling & Logging
- Backend:
  - Clear 400 messages for duplicates and commit failures
  - 404 for missing resources; 403 for access; 422 avoided by relaxed response schemas
- Frontend:
  - Specific messages per status; duplicate detection client-side for pipe joints
- Audit logs:
  - Date-based retrieval (admin only); JSON lines snapshots for selected entities

## 8. Security Controls
- Authentication: JWT; axios interceptor attaches token
- Authorization: role-based checks on all sensitive endpoints
- CORS: allowed origins configured in backend
- Transport: HTTPS recommended in production; dev uses http://127.0.0.1:8000
- Secrets: never logged; tokens cleared on 401

## 9. Privacy & Data Protection
- Scope: operational fabrication data (no sensitive personal data beyond user accounts)
- Minimization: store only necessary fields for inspection workflows
- Retention & deletion policies (see §10)
- Access limited to assigned projects; admin oversight for cross-project visibility

## 10. Data Retention Policy
- Inspection records (Master Joint, Fit-up, Final, NDT):
  - Retention: minimum 5 years post-project close; configurable per contract
  - Immutable outcomes: do not delete accepted final outcomes; allow corrective append-only entries
- Material Register:
  - Retention: minimum 3 years; keep upload source metadata (filename, timestamp)
- User & Access Logs:
  - Retention: minimum 1 year for audit trail
- Purge Procedure:
  - Admin-only script to archive and purge by project close date + retention period
  - Export CSV/JSON snapshots before purge; record purge manifests

## 11. Backup & Restore
- Backup
  - Daily full DB export; hourly incremental (production)
  - Include schema and index definitions; store in secure, geo-redundant storage
  - Verify backups via checksum and periodic test restores
- Restore
  - Staging restore with integrity checks before production cutover
  - Preserve application version alignment; run migrations post-restore
  - Document RTO (≤ 4 hours) and RPO (≤ 24 hours)

## 12. Change Management
- RFC Workflow
  - Proposal: issue with scope, risk, rollback plan
  - Review: code review + QA sign-off
  - Approval: product owner & security officer for major changes
  - Deployment: staged rollout; monitor logs and metrics
- Versioning
  - Semantic version for backend and frontend
  - Migration scripts versioned; idempotent and reversible where possible
- Rollback
  - Pre-deploy DB snapshot; feature flags for risky behavior toggles

## 13. Incident Response
- Detection: monitor 5xx rates, auth failures, DB constraint violations
- Triage: categorize by severity; assign functional owner
- Mitigation: hotfix or rollback; apply rate limiting if needed
- Post-Incident: root cause analysis; write corrective actions; update tests

## 14. Quality Assurance & Testing
- Unit tests: models, route validations, duplicate guards
- Integration tests: end-to-end for upload, fit-up → final → NDT flows
- Performance: indices verified; pagination recommended for large datasets
- Acceptance: user stories mapped to tests; pre-release checklist

## 15. Release & Deployment
- Environments: dev, staging, production
- Dev Bypass: TEST_LOGIN_BYPASS for GET endpoints only (development)
- CI/CD: lint, build, tests, migrations; change approvals documented
- Observability: structured logs, error tracking, basic metrics (TBD)

## 16. Disaster Recovery
- DR Plan: scheduled backups, documented restore runbook, environment replication
- DR Drills: quarterly restore tests; measure RTO/RPO adherence
- Dependencies: verify network, secrets, storage, and runtime versions

## 17. Governance & Compliance Mapping
- Access Control: role-based enforcement
- Data Integrity: composite uniqueness, auto-fill, clear constraints
- Auditability: endpoint logs, immutable accepted final outcomes
- Retention/Backup/Restore: defined procedures and SLAs
- Change Management: RFC, approvals, rollback plans
- Incident Response: triage and corrective action loop

## 18. Risks & Mitigations
- Duplicate joints: DB-level and route-level guards; UI detection
- Schema drift: runtime migration checks; tests for column presence
- Long lists: future pagination; index coverage monitored
- Enum values in legacy records: relaxed response schemas; normalization path planned

## 19. References
- Frontend routing: [App.tsx](../frontend/src/App.tsx)
- API client: [api.ts](../frontend/src/services/api.ts)
- Backend bootstrap: [main.py](../backend/app/main.py)
- Models: [models.py](../backend/app/models.py)
- Pipe Routes: [pipe_inspections.py](../backend/app/routes/pipe_inspections.py)
- Structure Routes: [structure_inspections.py](../backend/app/routes/structure_inspections.py)

## 20. Roles & Responsibilities
- Product Owner: requirements, approvals
- Lead Engineer: architecture, code quality, deployments
- Security Officer: access, audit, compliance oversight
- QA Lead: test plans, acceptance criteria

## 21. Glossary
- Fit-up: pre-weld inspection step
- Final: post-weld inspection step
- NDT: non-destructive testing (RT, UT, PT, MPI, etc.)
- WPS: Welding Procedure Specification

## 22. Revision History
- v3.0 (2026-01-25): Composite uniqueness, duplicate guards, enum relaxation, autofill on update, compliance sections added

---
Printing Notes:
- Export this Markdown to PDF using any Markdown-to-PDF tool (e.g., Pandoc) or paste to a word processor and save as PDF.
