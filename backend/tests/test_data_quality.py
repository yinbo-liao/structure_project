"""Data-quality scan: registry typos, chain drift, references, and report formats."""
import pytest

from app.models import (
    NDTTypes,
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
from app.services.data_quality_service import clear_scan_cache


@pytest.fixture(autouse=True)
def _clear_cache():
    clear_scan_cache()
    yield
    clear_scan_cache()


def _seed_chain(db, project_id, *, joint_no="J-101", draw_no="D-001", rev="A"):
    master = StructureMasterJointList(
        project_id=project_id,
        joint_no=joint_no,
        draw_no=draw_no,
        structure_category="COL",
        page_no="1",
        drawing_rev=rev,
        block_no="B-1",
    )
    db.add(master)
    db.flush()

    fitup = StructureFitUpInspection(
        project_id=project_id,
        joint_no=joint_no,
        draw_no=draw_no,
        structure_category="COL",
        page_no="1",
        drawing_rev=rev,
        block_no="B-1",
        master_joint_id=master.id,
        part1_piece_mark_no="PM-100",
    )
    db.add(fitup)
    db.flush()

    final = StructureFinalInspection(
        project_id=project_id,
        joint_no=joint_no,
        draw_no=draw_no,
        structure_category="COL",
        page_no="1",
        block_no="B-1",
        fitup_id=fitup.id,
    )
    db.add(final)
    db.flush()

    request = StructureNDTRequest(
        project_id=project_id,
        joint_no=joint_no,
        draw_no=draw_no,
        structure_category="COL",
        page_no="1",
        drawing_rev=rev,
        block_no="B-1",
        final_id=final.id,
        ndt_type=NDTTypes.RT,
    )
    db.add(request)
    db.flush()

    status = StructureNDTStatusRecord(
        project_id=project_id,
        joint_no=joint_no,
        draw_no=draw_no,
        structure_category="COL",
        page_no="1",
        drawing_rev=rev,
        block_no="B-1",
        final_id=final.id,
        ndt_type="RT",
    )
    db.add(status)
    db.flush()

    return master, fitup, final, request, status


def test_scan_detects_registry_typos_and_report_format(client, admin_headers, make_project, db_session):
    project = make_project()
    project_id = project["id"]

    db_session.add_all([
        WPSRegister(project_id=project_id, wps_no="WPS-100"),
        WelderRegister(project_id=project_id, welder_no="W-100"),
        StructureMaterialRegister(project_id=project_id, piece_mark_no="PM-100"),
    ])
    master, fitup, final, request, status = _seed_chain(db_session, project_id)

    final.wps_no = "WPS-1O0"      # letter O instead of zero
    final.welder_no = "W-999"     # no close candidate
    request.ndt_report_no = "RT0012"
    db_session.add(NDTTest(
        project_id=project_id,
        final_id=final.id,
        project_type="structure",
        method=NDTTypes.RT,
        report_no="RT-REPORT-0012",
    ))
    db_session.commit()

    response = client.get(
        f"/api/v1/ai/data-quality/{project_id}", headers=admin_headers
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["read_only"] is True
    assert body["truncated"] is False

    findings = body["findings"]
    wps = [item for item in findings if item["field"] == "wps_no"]
    assert wps and wps[0]["check"] == "typo"
    assert wps[0]["suggestion"] == "WPS-100"
    assert wps[0]["severity"] == "medium"

    welder = [item for item in findings if item["field"] == "welder_no" and item["entity"] == "final_inspection"]
    assert welder and welder[0]["severity"] == "high"
    assert welder[0]["check"] == "missing_reference"

    report = [item for item in findings if item["field"] == "ndt_report_no"]
    assert report and report[0]["check"] == "format"
    assert report[0]["suggestion"] == "RT-REPORT-0012"


def test_scan_filters_by_severity(client, admin_headers, make_project, db_session):
    project = make_project()
    project_id = project["id"]
    master, fitup, final, request, status = _seed_chain(db_session, project_id)
    final.welder_no = "W-999"
    db_session.commit()

    response = client.get(
        f"/api/v1/ai/data-quality/{project_id}?severity=high",
        headers=admin_headers,
    )
    assert response.status_code == 200, response.text
    findings = response.json()["findings"]
    assert findings
    assert all(item["severity"] == "high" for item in findings)


def test_scan_detects_chain_drift_and_broken_references(client, admin_headers, make_project, db_session):
    project = make_project()
    project_id = project["id"]
    master, fitup, final, request, status = _seed_chain(db_session, project_id)
    fitup.draw_no = "D-999"
    final.fitup_id = 999999
    db_session.commit()

    response = client.get(
        f"/api/v1/ai/data-quality/{project_id}", headers=admin_headers
    )
    assert response.status_code == 200, response.text
    findings = response.json()["findings"]

    drift = [
        item for item in findings
        if item["entity"] == "fitup_inspection" and item["field"] == "draw_no" and item["check"] == "mismatch"
    ]
    assert drift and drift[0]["expected"] == "D-001"

    broken = [
        item for item in findings
        if item["entity"] == "final_inspection" and item["field"] == "fitup_id" and item["check"] == "missing_reference"
    ]
    assert broken and broken[0]["severity"] == "high"


def test_scan_rejects_unassigned_user(client, admin_headers, make_project, make_user):
    project = make_project()
    _, headers = make_user(role="inspector")
    response = client.get(
        f"/api/v1/ai/data-quality/{project['id']}", headers=headers
    )
    assert response.status_code == 403


def test_scan_empty_project_is_clean(client, admin_headers, make_project):
    project = make_project()
    response = client.get(
        f"/api/v1/ai/data-quality/{project['id']}", headers=admin_headers
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["records_scanned"] == 0
    assert body["findings"] == []
    assert body["total_findings"] == 0
