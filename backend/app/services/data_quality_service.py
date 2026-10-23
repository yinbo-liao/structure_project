"""Deterministic, read-only data-quality checks for structure QA records.

The service loads each project-scoped table once, normalizes identifiers in
memory, and returns advisory findings. It never writes to QA tables and never
calls an LLM, so typo detection works without an API key.
"""
from __future__ import annotations

import difflib
import os
import re
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from time import monotonic
from typing import Any, Dict, Iterable, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models import (
    NDTTest,
    StructureFinalInspection,
    StructureFitUpInspection,
    StructureMasterJointList,
    StructureMaterialRegister,
    StructureNDTRequest,
    StructureNDTStatusRecord,
    WelderRegister,
    WPSRegister,
)
from app.utils.ndt_report_validator import (
    VALID_NDT_TYPES,
    extract_ndt_report_info,
    validate_ndt_report_number,
)

AI_SCAN_MAX_RECORDS = int(os.getenv("AI_SCAN_MAX_RECORDS", "20000"))
AI_SCAN_CACHE_TTL = float(os.getenv("AI_SCAN_CACHE_TTL", "15"))
AI_FUZZY_THRESHOLD = float(os.getenv("AI_FUZZY_THRESHOLD", "0.82"))
AI_FUZZY_MARGIN = 0.05

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_SEPARATORS = re.compile(r"[\s\-_/.]+")

_HYGIENE_FIELDS = (
    "joint_no", "draw_no", "drawing_no", "block_no", "structure_category",
    "page_no", "drawing_rev", "wps_no", "welder_no", "piece_mark_no",
    "part1_piece_mark_no", "part2_piece_mark_no", "ndt_report_no",
    "report_no", "fit_up_report_no", "final_report_no",
)

_MASTER_NDT_COLUMNS = (
    ("RT", "ndt_rt_report_no", "ndt_rt_result"),
    ("UT", "ndt_ut_report_no", "ndt_ut_result"),
    ("MPI", "ndt_mpi_report_no", "ndt_mpi_result"),
    ("PT", "ndt_pt_report_no", "ndt_pt_result"),
    ("PMI", "ndt_pmi_report_no", "ndt_pmi_result"),
    ("FT", "ndt_ft_report_no", "ndt_ft_result"),
    ("PAUT", "ndt_paut_report_no", "ndt_paut_result"),
)


def normalize_text(value: Any) -> str:
    """NFKC normalization, control-character removal, trimmed whitespace."""
    if value is None:
        return ""
    text = unicodedata.normalize("NFKC", str(value))
    text = _CONTROL_CHARS.sub("", text)
    return " ".join(text.split()).strip()


def normalize_key(value: Any) -> str:
    """Canonical comparison key (case-insensitive)."""
    return normalize_text(value).casefold()


def loose_key(value: Any) -> str:
    """Comparison key that ignores separators, for registry candidates only."""
    return _SEPARATORS.sub("", normalize_key(value))


def _clean(value: Any) -> str:
    return normalize_text(value)


def _value(obj: Any, field: str) -> Any:
    return getattr(obj, field, None)


def _enum_value(value: Any) -> Optional[str]:
    if value is None:
        return None
    return normalize_text(getattr(value, "value", value)) or None


def _split_types(value: Any) -> List[str]:
    if value is None:
        return []
    return [part.strip().upper() for part in re.split(r"[,;/]", str(getattr(value, "value", value))) if part.strip()]


def _split_reports(value: Any) -> List[str]:
    if value is None:
        return []
    return [part.strip() for part in re.split(r"[,;]", str(value)) if part.strip()]


def _best_match(value: str, candidates: Iterable[str], threshold: float = AI_FUZZY_THRESHOLD) -> Tuple[Optional[str], float]:
    """Return an unambiguous fuzzy candidate above the threshold."""
    key = normalize_key(value)
    scored: List[Tuple[str, float]] = []
    for candidate in candidates:
        cand_key = normalize_key(candidate)
        if not cand_key or cand_key == key:
            continue
        if loose_key(candidate) == loose_key(value):
            return candidate, 1.0
        scored.append((candidate, difflib.SequenceMatcher(None, key, cand_key).ratio()))
    if not scored:
        return None, 0.0
    scored.sort(key=lambda item: item[1], reverse=True)
    best, score = scored[0]
    if score < threshold:
        return None, score
    if len(scored) > 1 and score - scored[1][1] < AI_FUZZY_MARGIN:
        return None, score
    return best, score


def _repair_report_number(value: str, expected_type: Optional[str]) -> Optional[str]:
    """Conservative format repair; only returns a value that validates."""
    text = normalize_text(value).upper().replace(" ", "")
    if not text:
        return None
    candidates: List[Tuple[str, Optional[str]]] = []
    match = re.match(r"^([A-Z]{2,4})(?:REPORT)?[-_]?(\d{1,6})$", text)
    if match and match.group(1) in VALID_NDT_TYPES:
        candidates.append((match.group(1), match.group(2)))
    match = re.match(r"^(\d{1,6})$", text)
    if match and expected_type:
        candidates.append((expected_type.upper(), match.group(1)))
    for found_type, serial in candidates:
        if found_type not in VALID_NDT_TYPES:
            continue
        suggestion = f"{found_type}-REPORT-{int(serial):04d}"
        if validate_ndt_report_number(suggestion, found_type)[0]:
            return suggestion
    return None


class DataQualityService:
    """Run advisory identifier checks for one project."""

    def __init__(self, db: Session):
        self.db = db

    # ---------- loading ----------

    def _load(self, model, project_id: int, limit: int) -> Tuple[List[Any], bool]:
        rows = (
            self.db.query(model)
            .filter(model.project_id == project_id)
            .limit(limit + 1)
            .all()
        )
        truncated = len(rows) > limit
        return rows[:limit], truncated

    def scan_project(self, project_id: int, max_records: Optional[int] = None) -> Dict[str, Any]:
        limit = max(1, min(max_records or AI_SCAN_MAX_RECORDS, AI_SCAN_MAX_RECORDS))
        started = monotonic()

        sources = {
            "structure_master_joint_list": StructureMasterJointList,
            "structure_material_register": StructureMaterialRegister,
            "structure_fitup_inspection": StructureFitUpInspection,
            "structure_final_inspection": StructureFinalInspection,
            "structure_ndt_requests": StructureNDTRequest,
            "structure_ndt_status_records": StructureNDTStatusRecord,
            "ndt_tests": NDTTest,
            "wps_register": WPSRegister,
            "welder_register": WelderRegister,
        }
        loaded: Dict[str, List[Any]] = {}
        scans: Dict[str, int] = {}
        truncated_any = False
        for name, model in sources.items():
            rows, truncated = self._load(model, project_id, limit)
            loaded[name] = rows
            scans[name] = len(rows)
            truncated_any = truncated_any or truncated

        findings: List[Dict[str, Any]] = []

        def add(
            check: str,
            severity: str,
            entity: str,
            record_id: int,
            field: str,
            value: Any,
            message: str,
            *,
            expected: Any = None,
            suggestion: Any = None,
            confidence: Optional[float] = None,
        ) -> None:
            findings.append({
                "id": f"{entity}:{record_id}:{field}:{check}" if field else f"{entity}:{record_id}:{check}",
                "check": check,
                "severity": severity,
                "entity": entity,
                "record_id": record_id,
                "field": field,
                "value": None if value is None else str(value),
                "expected": None if expected is None else str(expected),
                "confidence": confidence,
                "message": message,
                "suggestion": None if suggestion is None else str(suggestion),
            })

        master = loaded["structure_master_joint_list"]
        materials = loaded["structure_material_register"]
        fitups = loaded["structure_fitup_inspection"]
        finals = loaded["structure_final_inspection"]
        requests = loaded["structure_ndt_requests"]
        statuses = loaded["structure_ndt_status_records"]
        tests = loaded["ndt_tests"]
        wps_rows = loaded["wps_register"]
        welder_rows = loaded["welder_register"]

        master_by_id = {row.id: row for row in master}
        fitup_by_id = {row.id: row for row in fitups}
        final_by_id = {row.id: row for row in finals}

        wps_values = [row.wps_no for row in wps_rows if _clean(row.wps_no)]
        welder_values = [row.welder_no for row in welder_rows if _clean(row.welder_no)]
        material_values = [row.piece_mark_no for row in materials if _clean(row.piece_mark_no)]
        wps_keys = {normalize_key(value) for value in wps_values}
        welder_keys = {normalize_key(value) for value in welder_values}
        material_keys = {normalize_key(value) for value in material_values}

        # 1. Registry existence and typo suggestions.
        def check_registry(entity: str, record, field: str, registry_values: List[str], registry_keys: set, label: str) -> None:
            raw = _value(record, field)
            key = normalize_key(raw)
            if not key or key in registry_keys:
                return
            candidate, score = _best_match(str(raw), registry_values)
            if candidate:
                add(
                    "typo", "medium", entity, record.id, field, raw,
                    f"{field} '{raw}' was not found in the {label}; closest match is '{candidate}'",
                    expected=candidate, suggestion=candidate, confidence=round(score, 3),
                )
            else:
                add(
                    "missing_reference", "high", entity, record.id, field, raw,
                    f"{field} '{raw}' was not found in the {label}",
                )

        for record in finals:
            check_registry("final_inspection", record, "wps_no", wps_values, wps_keys, "WPS register")
            check_registry("final_inspection", record, "welder_no", welder_values, welder_keys, "welder register")
        for record in requests:
            check_registry("ndt_request", record, "welder_no", welder_values, welder_keys, "welder register")
        for record in statuses:
            check_registry("ndt_status", record, "welder_no", welder_values, welder_keys, "welder register")
        for record in fitups:
            check_registry("fitup_inspection", record, "part1_piece_mark_no", material_values, material_keys, "material register")
            check_registry("fitup_inspection", record, "part2_piece_mark_no", material_values, material_keys, "material register")

        # 2. Chain drift across master -> fit-up -> final -> NDT request/status.
        identity_fields = ("joint_no", "block_no", "draw_no", "structure_category", "page_no", "drawing_rev")

        def compare_identity(entity: str, child, parent, parent_label: str, fields: Iterable[str]) -> None:
            if parent is None:
                return
            for field in fields:
                child_value = _value(child, field)
                parent_value = _value(parent, field)
                child_key = normalize_key(child_value)
                parent_key = normalize_key(parent_value)
                if not child_key or not parent_key or child_key == parent_key:
                    continue
                add(
                    "mismatch", "high", entity, child.id, field, child_value,
                    f"{field} '{child_value}' does not match {parent_label} value '{parent_value}'",
                    expected=parent_value,
                )

        for fitup in fitups:
            parent = master_by_id.get(fitup.master_joint_id) if fitup.master_joint_id else None
            compare_identity("fitup_inspection", fitup, parent, "master joint", identity_fields)
            if parent is not None:
                if _clean(fitup.fit_up_report_no) and _clean(parent.fit_up_report_no) and \
                        normalize_key(fitup.fit_up_report_no) != normalize_key(parent.fit_up_report_no):
                    add(
                        "mismatch", "high", "fitup_inspection", fitup.id, "fit_up_report_no", fitup.fit_up_report_no,
                        f"Fit-up report '{fitup.fit_up_report_no}' does not match master joint report '{parent.fit_up_report_no}'",
                        expected=parent.fit_up_report_no,
                    )
        for final in finals:
            parent = fitup_by_id.get(final.fitup_id) if final.fitup_id else None
            compare_identity("final_inspection", final, parent, "fit-up record", identity_fields[:-1])
        for request in requests:
            parent = final_by_id.get(request.final_id) if request.final_id else None
            compare_identity("ndt_request", request, parent, "final inspection", identity_fields[:-1])
        for status in statuses:
            parent = final_by_id.get(status.final_id) if status.final_id else None
            compare_identity("ndt_status", status, parent, "final inspection", identity_fields[:-1])

        # Master final report mirrors the linked final inspection.
        for fitup in fitups:
            parent = master_by_id.get(fitup.master_joint_id) if fitup.master_joint_id else None
            if parent is None or not _clean(parent.final_report_no):
                continue
            linked_finals = [item for item in finals if item.fitup_id == fitup.id]
            for final in linked_finals:
                if _clean(final.final_report_no) and normalize_key(final.final_report_no) != normalize_key(parent.final_report_no):
                    add(
                        "mismatch", "high", "final_inspection", final.id, "final_report_no", final.final_report_no,
                        f"Final report '{final.final_report_no}' does not match master joint report '{parent.final_report_no}'",
                        expected=parent.final_report_no,
                    )

        # 3. Broken or missing references.
        def check_reference(entity: str, record, field: str, target_map: Dict[int, Any], required: bool = False) -> None:
            target_id = _value(record, field)
            if target_id is None:
                if required:
                    add("missing_reference", "medium", entity, record.id, field, None,
                        f"{field} is not set, so this record cannot be linked to its parent")
                return
            if target_id not in target_map:
                add("missing_reference", "high", entity, record.id, field, target_id,
                    f"{field} {target_id} does not resolve to a record in this project")

        for record in fitups:
            check_reference("fitup_inspection", record, "master_joint_id", master_by_id)
        for record in finals:
            check_reference("final_inspection", record, "fitup_id", fitup_by_id)
        for record in requests:
            check_reference("ndt_request", record, "final_id", final_by_id, required=True)
        for record in statuses:
            check_reference("ndt_status", record, "final_id", final_by_id, required=True)
        for record in tests:
            check_reference("ndt_test", record, "final_id", final_by_id, required=True)

        # 4. Report number format, type, and pairing.
        def check_report(entity: str, record, field: str, expected_type: Optional[str], report_value: Any) -> None:
            raw = _clean(report_value)
            if not raw:
                return
            expected = expected_type.upper() if expected_type else None
            is_valid, message = validate_ndt_report_number(raw, expected)
            if is_valid:
                return
            info = extract_ndt_report_info(raw)
            suggestion = _repair_report_number(raw, expected)
            if info and expected and info[0] != expected:
                add(
                    "mismatch", "high", entity, record.id, field, raw,
                    f"Report number type '{info[0]}' does not match NDT type '{expected}'",
                    expected=f"{expected}-REPORT-{info[1]}", suggestion=f"{expected}-REPORT-{info[1]}",
                )
            else:
                add(
                    "format", "medium", entity, record.id, field, raw,
                    message or "Report number does not match the required NDT report format",
                    expected="NDT_TYPE-REPORT-SERIAL_NO", suggestion=suggestion,
                    confidence=0.9 if suggestion else None,
                )

        for record in requests:
            check_report("ndt_request", record, "ndt_report_no", _enum_value(record.ndt_type), record.ndt_report_no)
        for record in statuses:
            types = _split_types(record.ndt_type)
            reports = _split_reports(record.ndt_report_no)
            if len(reports) == 1 and len(types) > 1:
                for ndt_type in types:
                    check_report("ndt_status", record, "ndt_report_no", ndt_type, reports[0])
            elif len(reports) == len(types) and len(reports) > 1:
                for ndt_type, report in zip(types, reports):
                    check_report("ndt_status", record, "ndt_report_no", ndt_type, report)
            else:
                for report in reports:
                    check_report("ndt_status", record, "ndt_report_no", None, report)
                if len(reports) > 1 and len(types) != len(reports):
                    add(
                        "format", "medium", "ndt_status", record.id, "ndt_type", record.ndt_type,
                        f"{len(types)} NDT type(s) cannot be paired with {len(reports)} report number(s)",
                        expected="matching type and report counts",
                    )
        for record in tests:
            expected_type = _enum_value(record.method)
            if expected_type == "MT":
                expected_type = "MPI"
            check_report("ndt_test", record, "report_no", expected_type, record.report_no)
        for record in master:
            for ndt_type, report_field, _ in _MASTER_NDT_COLUMNS:
                check_report("master_joint", record, report_field, ndt_type, _value(record, report_field))

        # 5. Duplicates and 1:1 violations.
        finals_by_fitup = defaultdict(list)
        for final in finals:
            if final.fitup_id:
                finals_by_fitup[final.fitup_id].append(final)
        for fitup_id, rows in finals_by_fitup.items():
            if len(rows) > 1:
                for duplicate in rows[1:]:
                    add("duplicate", "medium", "final_inspection", duplicate.id, "fitup_id", fitup_id,
                        f"Fit-up {fitup_id} has {len(rows)} final inspections; expected one",
                        expected=f"a single final inspection for fit-up {fitup_id}")

        status_groups = defaultdict(list)
        for status in statuses:
            key = (
                status.final_id,
                tuple(sorted(_split_types(status.ndt_type))),
                normalize_key(status.ndt_report_no),
            )
            status_groups[key].append(status)
        for rows in status_groups.values():
            if len(rows) > 1:
                for duplicate in rows[1:]:
                    add("duplicate", "medium", "ndt_status", duplicate.id, "ndt_type", duplicate.ndt_type,
                        f"Duplicate NDT status record for final {duplicate.final_id} and type '{duplicate.ndt_type}'")

        test_groups = defaultdict(list)
        for test in tests:
            key = (test.final_id, _enum_value(test.method), normalize_key(test.report_no))
            test_groups[key].append(test)
        for rows in test_groups.values():
            if len(rows) > 1 and rows[0].report_no:
                for duplicate in rows[1:]:
                    add("duplicate", "medium", "ndt_test", duplicate.id, "report_no", duplicate.report_no,
                        f"Duplicate NDT test report '{duplicate.report_no}' for final {duplicate.final_id}")

        self._check_registry_duplicates(
            "wps_register", wps_rows, "wps_no", add, "WPS"
        )
        self._check_registry_duplicates(
            "welder_register", welder_rows, "welder_no", add, "welder"
        )
        self._check_registry_duplicates(
            "material_register", materials, "piece_mark_no", add, "piece mark"
        )

        # 6. Hygiene.
        for entity, rows in (
            ("master_joint", master),
            ("material_register", materials),
            ("fitup_inspection", fitups),
            ("final_inspection", finals),
            ("ndt_request", requests),
            ("ndt_status", statuses),
            ("ndt_test", tests),
            ("wps_register", wps_rows),
            ("welder_register", welder_rows),
        ):
            for record in rows:
                for field in _HYGIENE_FIELDS:
                    raw = _value(record, field)
                    if raw is None:
                        continue
                    cleaned = _clean(raw)
                    if cleaned != str(raw):
                        add("hygiene", "low", entity, record.id, field, raw,
                            f"{field} contains leading/trailing whitespace or control characters",
                            suggestion=cleaned)

        findings = self._deduplicate_findings(findings)
        by_severity = {"high": 0, "medium": 0, "low": 0}
        by_check: Dict[str, int] = {}
        for finding in findings:
            by_severity[finding["severity"]] = by_severity.get(finding["severity"], 0) + 1
            by_check[finding["check"]] = by_check.get(finding["check"], 0) + 1

        return {
            "project_id": project_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "read_only": True,
            "records_scanned": sum(scans.values()),
            "scanned": scans,
            "truncated": truncated_any,
            "duration_ms": round((monotonic() - started) * 1000, 2),
            "total_findings": len(findings),
            "by_severity": by_severity,
            "by_check": by_check,
            "findings": findings,
        }

    @staticmethod
    def _check_registry_duplicates(entity: str, rows: List[Any], field: str, add, label: str) -> None:
        groups: Dict[str, List[Any]] = defaultdict(list)
        for row in rows:
            key = normalize_key(_value(row, field))
            if key:
                groups[key].append(row)
        for values in groups.values():
            if len(values) > 1:
                for duplicate in values[1:]:
                    add("duplicate", "medium", entity, duplicate.id, field, _value(duplicate, field),
                        f"Duplicate {label} value; records normalize to the same identifier")

    @staticmethod
    def _deduplicate_findings(findings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        seen = set()
        unique: List[Dict[str, Any]] = []
        for finding in findings:
            key = (finding["check"], finding["entity"], finding["record_id"], finding["field"], finding["value"])
            if key in seen:
                continue
            seen.add(key)
            unique.append(finding)
        unique.sort(key=lambda item: ({"high": 0, "medium": 1, "low": 2}.get(item["severity"], 3), item["entity"], item["record_id"]))
        return unique


# Small in-process cache: findings are dicts, while app.cache stores strings only.
_SCAN_CACHE: Dict[int, Tuple[float, Dict[str, Any]]] = {}
_AI_SCAN_CACHE_MAX = max(1, int(os.getenv("AI_SCAN_CACHE_MAX_PROJECTS", "50")))


def scan_project_cached(db: Session, project_id: int, max_records: Optional[int] = None) -> Dict[str, Any]:
    now = monotonic()
    cached = _SCAN_CACHE.get(project_id)
    if cached and now - cached[0] < AI_SCAN_CACHE_TTL:
        return cached[1]
    for key, (generated_at, _) in list(_SCAN_CACHE.items()):
        if now - generated_at >= AI_SCAN_CACHE_TTL:
            _SCAN_CACHE.pop(key, None)
    if len(_SCAN_CACHE) >= _AI_SCAN_CACHE_MAX:
        oldest = min(_SCAN_CACHE.items(), key=lambda item: item[1][0])[0]
        _SCAN_CACHE.pop(oldest, None)
    result = DataQualityService(db).scan_project(project_id, max_records=max_records)
    _SCAN_CACHE[project_id] = (now, result)
    return result


def clear_scan_cache() -> None:
    _SCAN_CACHE.clear()
