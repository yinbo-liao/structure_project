"""Golden-case evaluation harness for the QA assistant.

Fake mode runs the real graph with a scripted, no-network LLM so the tool
loop, citation filtering, and deterministic findings are exercised in CI.
Live mode is opt-in and calls the configured DeepSeek-compatible endpoint.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

from sqlalchemy.orm import Session

from app.models import (
    Project,
    StructureFinalInspection,
    User,
    UserRole,
    WelderRegister,
    WPSRegister,
)
from app.services.assistant_service import AssistantService, reset_rate_limits
from app.services.llm_client import LLMResult, ToolCall

_ENTITY_PREFIXES = {
    "master_joint": "joint:",
    "material_register": "material:",
    "fitup_inspection": "fitup:",
    "final_inspection": "final:",
    "ndt_request": "ndt_request:",
    "ndt_status": "ndt_status:",
    "ndt_test": "ndt_test:",
    "wps_register": "wps:",
    "welder_register": "welder:",
}


class ScriptedLLM:
    """Deterministic stand-in that reads citation ids from the built context."""

    available = True

    def __init__(self, case: Dict[str, Any]):
        self.case = case
        self.calls = 0

    def chat(self, messages: List[Dict[str, Any]], **kwargs: Any) -> LLMResult:
        self.calls += 1
        has_tool_result = any(message.get("role") == "tool" for message in messages)
        tool_name = self.case.get("expect_tool")
        if tool_name and not has_tool_result:
            return LLMResult(
                content="",
                tool_calls=[ToolCall(id="eval-call-1", name=tool_name, arguments={})],
                usage={"total_tokens": 40},
            )

        records = _context_records(messages)
        expected_entities = self.case.get("expect_citation_entities") or []
        chosen = None
        for entity in expected_entities:
            prefix = _ENTITY_PREFIXES.get(entity)
            if not prefix:
                continue
            chosen = next(
                (record["citation_id"] for record in records
                 if str(record.get("citation_id", "")).startswith(prefix)),
                None,
            )
            if chosen:
                break
        if not chosen and records:
            chosen = records[0]["citation_id"]

        content = (
            f"Based on the project records, see [{chosen}]."
            if chosen
            else "No matching records were found in this project."
        )
        return LLMResult(content=content, usage={"total_tokens": 50})


class UnavailableLLM:
    """Forces the deterministic no-key path without touching environment state."""

    available = False

    def chat(self, *args: Any, **kwargs: Any) -> LLMResult:
        raise AssertionError("deterministic mode must not call the LLM")


def _context_records(messages: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    for message in reversed(messages):
        if message.get("role") != "user":
            continue
        match = re.search(r"<project_data>\s*(.*?)\s*</project_data>", message.get("content", ""), re.S)
        if not match:
            continue
        try:
            data = json.loads(match.group(1))
        except (ValueError, TypeError):
            return []
        records = data.get("records") or []
        return [record for record in records if isinstance(record, dict)]
    return []


def load_cases(path: Path) -> List[Dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError("eval cases must be a JSON list")
    return data


def evaluate_case(case: Dict[str, Any], response: Dict[str, Any]) -> List[str]:
    failures: List[str] = []
    findings = response.get("findings") or []
    citations = response.get("citations") or []
    metrics = response.get("metrics") or {}
    tool_runs = response.get("tool_runs") or []

    expected_findings = case.get("expect_findings")
    if expected_findings is True and not findings:
        failures.append("expected findings but none were returned")
    if expected_findings is False and findings:
        failures.append(f"expected no findings, got {len(findings)}")

    severities = {finding.get("severity") for finding in findings}
    for severity in case.get("expect_severities", []):
        if severity not in severities:
            failures.append(f"missing severity {severity}")

    citation_entities = {citation.get("entity") for citation in citations}
    for entity in case.get("expect_citation_entities", []):
        if entity not in citation_entities:
            failures.append(f"missing citation entity {entity}")

    if "expect_fallback" in case and bool(metrics.get("fallback")) != bool(case["expect_fallback"]):
        failures.append(
            f"fallback expected {case['expect_fallback']}, got {metrics.get('fallback')}"
        )

    tool_names = {run.get("name") for run in tool_runs}
    for name in case.get("expect_tools", []):
        if name not in tool_names:
            failures.append(f"missing tool run {name}")

    if case.get("expect_verified", True) and response.get("verified") is False:
        failures.append("response was not verified")

    return failures


def run_cases(
    db: Session,
    user: User,
    project_id: int,
    cases: Sequence[Dict[str, Any]],
    *,
    live_llm=None,
) -> Dict[str, Any]:
    reset_rate_limits()
    results: List[Dict[str, Any]] = []
    for case in cases:
        mode = case.get("mode", "scripted")
        if live_llm is not None:
            llm = live_llm
        elif mode == "deterministic":
            llm = UnavailableLLM()
        else:
            llm = ScriptedLLM(case)
        service = AssistantService(db, user, project_id, llm=llm)
        try:
            response = service.chat(case["query"])
            failures = evaluate_case(case, response)
        except Exception as exc:  # a crashing case is a failed case
            response = {}
            failures = [f"assistant raised {type(exc).__name__}: {exc}"]
        results.append({
            "id": case.get("id") or case["query"][:40],
            "passed": not failures,
            "failures": failures,
            "findings": len(response.get("findings") or []),
            "citations": len(response.get("citations") or []),
            "fallback": bool((response.get("metrics") or {}).get("fallback")),
            "answer": (response.get("message") or {}).get("content", "")[:160],
        })
    reset_rate_limits()
    failed = sum(1 for result in results if not result["passed"])
    return {"passed": len(results) - failed, "failed": failed, "results": results}


def seed_eval_project(db: Session) -> tuple[User, Project]:
    """Create a disposable project with one typo and one clean record."""
    import uuid

    suffix = uuid.uuid4().hex[:8]
    user = User(
        email=f"ai-eval-{suffix}@example.test",
        hashed_password="not-used",
        full_name="AI eval",
        role=UserRole.ADMIN,
        is_active=True,
        password_change_required=False,
    )
    db.add(user)
    db.flush()
    project = Project(
        name=f"AI eval {suffix}",
        code=f"EVAL-{suffix}",
        description="Disposable project for the assistant evaluation harness",
        project_type="structure",
        owner_id=user.id,
    )
    db.add(project)
    db.flush()
    db.add_all([
        WPSRegister(project_id=project.id, wps_no="WPS-100"),
        WelderRegister(project_id=project.id, welder_no="W-100"),
        StructureFinalInspection(
            project_id=project.id,
            joint_no="J-101",
            draw_no="D-001",
            structure_category="COL",
            page_no="1",
            block_no="B-1",
            wps_no="WPS-1O0",
            welder_no="W-999",
        ),
    ])
    db.commit()
    db.refresh(user)
    db.refresh(project)
    return user, project


def run_fake_from_path(db: Session, user: User, project_id: int, path: Path) -> Dict[str, Any]:
    return run_cases(db, user, project_id, load_cases(path))


def format_report(report: Dict[str, Any]) -> str:
    lines = []
    for result in report["results"]:
        status = "PASS" if result["passed"] else "FAIL"
        lines.append(f"[{status}] {result['id']}: findings={result['findings']} citations={result['citations']}")
        for failure in result["failures"]:
            lines.append(f"       - {failure}")
    lines.append(f"Summary: {report['passed']} passed, {report['failed']} failed")
    return "\n".join(lines)
