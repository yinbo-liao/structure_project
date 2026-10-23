"""Run the assistant golden cases.

Examples (from backend/):

    python scripts/ai_eval.py --mode fake
    python scripts/ai_eval.py --mode live --project 1

Fake mode builds a disposable SQLite database and scripted LLM, so it needs no
API key and never touches the configured database. Live mode uses the
application database and the configured DeepSeek-compatible endpoint.
"""
from __future__ import annotations

import argparse
import os
import sys
import tempfile
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

DEFAULT_CASES = BACKEND_ROOT / "tests" / "data" / "ai_eval_cases.json"


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate the QA assistant")
    parser.add_argument("--mode", choices=("fake", "live"), default="fake")
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES)
    parser.add_argument("--project", type=int, help="Project id for live mode")
    parser.add_argument("--sqlite", type=Path, help="SQLite path for fake mode")
    return parser.parse_args()


def _run_fake(cases_path: Path, sqlite_path: Path | None) -> int:
    path = sqlite_path or Path(tempfile.mkdtemp(prefix="ai-eval-")) / "eval.db"
    os.environ.update({
        "DB_TYPE": "sqlite",
        "SQLITE_PATH": str(path),
        "SECRET_KEY": "ai-eval-only-not-a-secret",
        "DEEPSEEK_API_KEY": "",
        "AI_API_KEY": "",
        "ENVIRONMENT": "development",
    })

    from app.database import Base, SessionLocal, engine
    from app.services.ai_eval_service import format_report, load_cases, run_cases, seed_eval_project

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user, project = seed_eval_project(db)
        report = run_cases(db, user, project.id, load_cases(cases_path))
    finally:
        db.close()
    print(f"Mode: fake (sqlite {path})")
    print(format_report(report))
    return 1 if report["failed"] else 0


def _run_live(cases_path: Path, project_id: int) -> int:
    from app.database import SessionLocal
    from app.models import User, UserRole
    from app.services.ai_eval_service import format_report, load_cases, run_cases
    from app.services.llm_client import LLMClient

    llm = LLMClient()
    if not llm.available:
        print("Live mode needs DEEPSEEK_API_KEY (or AI_API_KEY) to be set.", file=sys.stderr)
        return 1

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.role == UserRole.ADMIN, User.is_active.is_(True)).first()
        if user is None:
            print("No active admin user found for live evaluation.", file=sys.stderr)
            return 1
        cases = [case for case in load_cases(cases_path) if case.get("mode") != "deterministic"]
        report = run_cases(db, user, project_id, cases, live_llm=llm)
    finally:
        db.close()
    print(f"Mode: live (project {project_id})")
    print(format_report(report))
    return 1 if report["failed"] else 0


def main() -> int:
    args = _parse_args()
    if not args.cases.exists():
        print(f"Cases file not found: {args.cases}", file=sys.stderr)
        return 1
    if args.mode == "live":
        if not args.project:
            print("--project is required for live mode", file=sys.stderr)
            return 1
        return _run_live(args.cases, args.project)
    return _run_fake(args.cases, args.sqlite)


if __name__ == "__main__":
    raise SystemExit(main())
