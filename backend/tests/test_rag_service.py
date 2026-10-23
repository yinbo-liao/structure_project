"""Project-scoped RAG retrieval over QA records."""
import pytest

from app.models import (
    NDTTypes,
    StructureFinalInspection,
    StructureFitUpInspection,
    StructureMasterJointList,
    StructureNDTStatusRecord,
    WelderRegister,
    WPSRegister,
)
from app.services.rag_service import (
    RagService,
    clear_rag_cache,
    get_project_documents,
)


@pytest.fixture(autouse=True)
def _clear_cache():
    clear_rag_cache()
    yield
    clear_rag_cache()


def _seed_project(db, project_id, joint_no, *, welder_no="W-100", wps_no="WPS-100", report="RT-REPORT-0012"):
    master = StructureMasterJointList(
        project_id=project_id,
        joint_no=joint_no,
        draw_no="D-001",
        structure_category="COL",
        page_no="1",
        drawing_rev="A",
        block_no="B-1",
    )
    db.add(master)
    db.flush()
    fitup = StructureFitUpInspection(
        project_id=project_id,
        joint_no=joint_no,
        draw_no="D-001",
        structure_category="COL",
        page_no="1",
        drawing_rev="A",
        block_no="B-1",
        master_joint_id=master.id,
        part1_piece_mark_no="PM-100",
    )
    db.add(fitup)
    db.flush()
    final = StructureFinalInspection(
        project_id=project_id,
        joint_no=joint_no,
        draw_no="D-001",
        structure_category="COL",
        page_no="1",
        block_no="B-1",
        fitup_id=fitup.id,
        wps_no=wps_no,
        welder_no=welder_no,
        final_report_no=f"FINAL-{joint_no}",
    )
    db.add(final)
    db.flush()
    db.add(StructureNDTStatusRecord(
        project_id=project_id,
        final_id=final.id,
        joint_no=joint_no,
        draw_no="D-001",
        structure_category="COL",
        page_no="1",
        drawing_rev="A",
        block_no="B-1",
        ndt_type="RT",
        ndt_report_no=report,
        ndt_result="accepted",
    ))
    db.add_all([
        WelderRegister(project_id=project_id, welder_no=welder_no),
        WPSRegister(project_id=project_id, wps_no=wps_no),
    ])
    db.commit()
    return master, final


def test_exact_identifier_ranks_matching_joint_first(make_project, db_session):
    project = make_project()
    master, final = _seed_project(db_session, project["id"], "J-101")

    results = RagService(db_session).search(project["id"], "J-101", top_k=10)
    assert results
    assert results[0]["identifiers"]["joint_no"] == "J-101"
    assert f"joint:{master.id}" in [item["citation_id"] for item in results]


def test_entity_filter_limits_results(make_project, db_session):
    project = make_project()
    _, final = _seed_project(db_session, project["id"], "J-202")

    results = RagService(db_session).search(
        project["id"], "W-100", top_k=10, source_types=["final_inspection"]
    )
    assert results
    assert all(item["entity"] == "final_inspection" for item in results)
    assert any(item["record_id"] == final.id for item in results)


def test_cross_project_records_never_enter_results(make_project, db_session):
    project_a = make_project()
    project_b = make_project()
    _seed_project(db_session, project_a["id"], "J-303", welder_no="W-303", wps_no="WPS-303")
    _seed_project(db_session, project_b["id"], "J-999", welder_no="W-999", wps_no="WPS-999")

    results = RagService(db_session).search(project_a["id"], "J-999", top_k=20)
    assert all(
        item["identifiers"].get("joint_no") != "J-999" for item in results
    )


def test_documents_are_cached_per_project(make_project, db_session):
    project = make_project()
    _seed_project(db_session, project["id"], "J-404")

    first = get_project_documents(db_session, project["id"])
    second = get_project_documents(db_session, project["id"])
    assert first is second
    assert first

    clear_rag_cache(project["id"])
    third = get_project_documents(db_session, project["id"])
    assert third is not first
    assert len(third) == len(first)
