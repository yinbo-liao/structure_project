"""Golden-case harness: the assistant passes the shipped eval cases offline."""
from pathlib import Path

import pytest

from app.services.ai_eval_service import (
    evaluate_case,
    format_report,
    load_cases,
    run_cases,
    seed_eval_project,
)
from app.services.data_quality_service import clear_scan_cache
from app.services.rag_service import clear_rag_cache

CASES_PATH = Path(__file__).parent / "data" / "ai_eval_cases.json"


@pytest.fixture(autouse=True)
def _clear_caches():
    clear_scan_cache()
    clear_rag_cache()
    yield
    clear_scan_cache()
    clear_rag_cache()


def test_fake_eval_cases_pass(client, db_session):
    user, project = seed_eval_project(db_session)
    report = run_cases(db_session, user, project.id, load_cases(CASES_PATH))
    assert report["failed"] == 0, format_report(report)
    assert report["passed"] >= 5


def test_harness_detects_mismatches():
    case = {
        "id": "negative",
        "query": "anything",
        "expect_findings": True,
        "expect_severities": ["high"],
        "expect_citation_entities": ["final_inspection"],
        "expect_fallback": True,
        "expect_tools": ["scan_data_quality"],
    }
    failures = evaluate_case(case, {
        "findings": [],
        "citations": [],
        "metrics": {"fallback": False},
        "tool_runs": [],
        "verified": True,
    })
    assert len(failures) == 5
