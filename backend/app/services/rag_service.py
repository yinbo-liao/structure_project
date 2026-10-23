"""Project-scoped lexical retrieval over QA records.

Documents are derived from the QA tables on demand; nothing is persisted. A
small in-process cache keeps the per-project corpus for a short TTL. Ranking is
BM25 plus an identifier boost so questions about a joint, welder, WPS, drawing,
or report number surface the right records.
"""
from __future__ import annotations

import difflib
import math
import os
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone
from time import monotonic
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

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
from app.services.data_quality_service import _enum_value, _split_types, normalize_text

AI_RAG_TOP_K = int(os.getenv("AI_RAG_TOP_K", "8"))
AI_RAG_CACHE_TTL = float(os.getenv("AI_RAG_CACHE_TTL", "120"))
AI_RAG_MAX_DOCS = int(os.getenv("AI_RAG_MAX_DOCS", "20000"))
AI_RAG_DOC_CHARS = int(os.getenv("AI_RAG_DOC_CHARS", "900"))

_TOKEN_RE = re.compile(r"[A-Za-z0-9]+")
_IDENTIFIER_RE = re.compile(r"\b[A-Za-z]{1,5}[-/]?\d{1,6}\b|\b\d{2,6}\b")
_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have",
    "how", "in", "is", "it", "of", "on", "or", "that", "the", "this", "to", "was",
    "what", "when", "where", "which", "who", "why", "with", "show", "list", "give",
    "me", "please", "tell", "about", "any", "all", "there",
}


@dataclass
class RagDocument:
    citation_id: str
    entity: str
    record_id: int
    label: str
    text: str
    identifiers: Dict[str, str] = field(default_factory=dict)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "citation_id": self.citation_id,
            "entity": self.entity,
            "record_id": self.record_id,
            "label": self.label,
            "text": self.text,
            "identifiers": self.identifiers,
        }


def tokenize(value: str) -> List[str]:
    text = unicodedata.normalize("NFKC", value or "").casefold()
    return _TOKEN_RE.findall(text)


def identifier_tokens(value: str) -> List[str]:
    """Tokens for an identifier, including a separator-free variant."""
    tokens = tokenize(value)
    condensed = "".join(tokens)
    if condensed and condensed not in tokens:
        tokens.append(condensed)
    return tokens


def _bounded(value: Any, max_chars: int = 120) -> str:
    text = normalize_text(value)
    return text[:max_chars]


def _text_part(label: str, value: Any) -> str:
    text = normalize_text(value)
    return f"{label}={text};" if text else ""


def _doc_text(parts: Iterable[str]) -> str:
    text = " ".join(part for part in parts if part).strip()
    if len(text) > AI_RAG_DOC_CHARS:
        text = text[:AI_RAG_DOC_CHARS] + "..."
    return text


class RagService:
    def __init__(self, db: Session):
        self.db = db

    # ---------- document construction ----------

    def build_documents(self, project_id: int, max_docs: Optional[int] = None) -> List[Dict[str, Any]]:
        limit = max(1, min(max_docs or AI_RAG_MAX_DOCS, AI_RAG_MAX_DOCS))
        documents: List[RagDocument] = []

        def load(model):
            return (
                self.db.query(model)
                .filter(model.project_id == project_id)
                .limit(limit)
                .all()
            )

        for row in load(StructureMasterJointList):
            identifiers = {
                "joint_no": _bounded(row.joint_no),
                "draw_no": _bounded(row.draw_no),
                "drawing_rev": _bounded(row.drawing_rev),
                "structure_category": _bounded(row.structure_category),
                "page_no": _bounded(row.page_no),
                "block_no": _bounded(row.block_no),
            }
            parts = [
                _text_part("Master joint", row.joint_no),
                _text_part("drawing", row.draw_no),
                _text_part("rev", row.drawing_rev),
                _text_part("category", row.structure_category),
                _text_part("page", row.page_no),
                _text_part("block", row.block_no),
                _text_part("thickness", row.thickness),
                _text_part("fitup status", row.fitup_status),
                _text_part("fitup report", row.fit_up_report_no),
                _text_part("final status", row.final_status),
                _text_part("final report", row.final_report_no),
                _text_part("comprehensive NDT status", row.ndt_comprehensive_status),
            ]
            for ndt_type, report_field, result_field in (
                ("RT", "ndt_rt_report_no", "ndt_rt_result"),
                ("UT", "ndt_ut_report_no", "ndt_ut_result"),
                ("MPI", "ndt_mpi_report_no", "ndt_mpi_result"),
                ("PT", "ndt_pt_report_no", "ndt_pt_result"),
                ("PMI", "ndt_pmi_report_no", "ndt_pmi_result"),
                ("FT", "ndt_ft_report_no", "ndt_ft_result"),
                ("PAUT", "ndt_paut_report_no", "ndt_paut_result"),
            ):
                report = getattr(row, report_field)
                result = getattr(row, result_field)
                if normalize_text(report) or normalize_text(result):
                    parts.append(f"{ndt_type} report={_bounded(report)} result={_bounded(result)};")
                    identifiers[f"{ndt_type}_report_no"] = _bounded(report)
            documents.append(RagDocument(
                citation_id=f"joint:{row.id}",
                entity="master_joint",
                record_id=row.id,
                label=f"Master joint {_bounded(row.joint_no) or row.id} / drawing {_bounded(row.draw_no)}",
                text=_doc_text(parts),
                identifiers={key: value for key, value in identifiers.items() if value},
            ))

        for row in load(StructureMaterialRegister):
            identifiers = {
                "piece_mark_no": _bounded(row.piece_mark_no),
                "drawing_no": _bounded(row.drawing_no),
                "drawing_rev": _bounded(row.drawing_rev),
                "block_no": _bounded(row.block_no),
            }
            documents.append(RagDocument(
                citation_id=f"material:{row.id}",
                entity="material_register",
                record_id=row.id,
                label=f"Material {_bounded(row.piece_mark_no) or row.id}",
                text=_doc_text([
                    _text_part("Piece mark", row.piece_mark_no),
                    _text_part("material", row.material_type),
                    _text_part("grade", row.grade),
                    _text_part("thickness", row.thickness),
                    _text_part("heat no", row.heat_no),
                    _text_part("drawing", row.drawing_no),
                    _text_part("rev", row.drawing_rev),
                    _text_part("block", row.block_no),
                    _text_part("inspection status", row.inspection_status),
                ]),
                identifiers={key: value for key, value in identifiers.items() if value},
            ))

        for row in load(StructureFitUpInspection):
            identifiers = {
                "joint_no": _bounded(row.joint_no),
                "draw_no": _bounded(row.draw_no),
                "drawing_rev": _bounded(row.drawing_rev),
                "page_no": _bounded(row.page_no),
                "block_no": _bounded(row.block_no),
                "part1_piece_mark_no": _bounded(row.part1_piece_mark_no),
                "part2_piece_mark_no": _bounded(row.part2_piece_mark_no),
            }
            documents.append(RagDocument(
                citation_id=f"fitup:{row.id}",
                entity="fitup_inspection",
                record_id=row.id,
                label=f"Fit-up {row.id} / joint {_bounded(row.joint_no)}",
                text=_doc_text([
                    _text_part("Fit-up joint", row.joint_no),
                    _text_part("drawing", row.draw_no),
                    _text_part("rev", row.drawing_rev),
                    _text_part("category", row.structure_category),
                    _text_part("page", row.page_no),
                    _text_part("block", row.block_no),
                    _text_part("report", row.fit_up_report_no),
                    _text_part("result", row.fit_up_result),
                    _text_part("weld type", row.weld_type),
                    _text_part("weld site", row.weld_site),
                    _text_part("part 1", row.part1_piece_mark_no),
                    _text_part("part 2", row.part2_piece_mark_no),
                ]),
                identifiers={key: value for key, value in identifiers.items() if value},
            ))

        for row in load(StructureFinalInspection):
            identifiers = {
                "joint_no": _bounded(row.joint_no),
                "draw_no": _bounded(row.draw_no),
                "page_no": _bounded(row.page_no),
                "block_no": _bounded(row.block_no),
                "wps_no": _bounded(row.wps_no),
                "welder_no": _bounded(row.welder_no),
                "final_report_no": _bounded(row.final_report_no),
            }
            documents.append(RagDocument(
                citation_id=f"final:{row.id}",
                entity="final_inspection",
                record_id=row.id,
                label=f"Final inspection {row.id} / joint {_bounded(row.joint_no)}",
                text=_doc_text([
                    _text_part("Final joint", row.joint_no),
                    _text_part("drawing", row.draw_no),
                    _text_part("category", row.structure_category),
                    _text_part("page", row.page_no),
                    _text_part("block", row.block_no),
                    _text_part("report", row.final_report_no),
                    _text_part("result", row.final_result),
                    _text_part("NDT type", row.ndt_type),
                    _text_part("weld length", row.weld_length),
                    _text_part("WPS", row.wps_no),
                    _text_part("welder", row.welder_no),
                    _text_part("welder validity", row.welder_validity),
                ]),
                identifiers={key: value for key, value in identifiers.items() if value},
            ))

        for row in load(StructureNDTRequest):
            identifiers = {
                "joint_no": _bounded(row.joint_no),
                "draw_no": _bounded(row.draw_no),
                "ndt_type": _enum_value(row.ndt_type) or "",
                "ndt_report_no": _bounded(row.ndt_report_no),
                "welder_no": _bounded(row.welder_no),
            }
            documents.append(RagDocument(
                citation_id=f"ndt_request:{row.id}",
                entity="ndt_request",
                record_id=row.id,
                label=f"NDT request {row.id} / joint {_bounded(row.joint_no)} / {_enum_value(row.ndt_type) or ''}",
                text=_doc_text([
                    _text_part("NDT request joint", row.joint_no),
                    _text_part("drawing", row.draw_no),
                    _text_part("category", row.structure_category),
                    _text_part("page", row.page_no),
                    _text_part("block", row.block_no),
                    _text_part("method", _enum_value(row.ndt_type)),
                    _text_part("report", row.ndt_report_no),
                    _text_part("result", row.ndt_result),
                    _text_part("status", row.status),
                    _text_part("welder", row.welder_no),
                ]),
                identifiers={key: value for key, value in identifiers.items() if value},
            ))

        for row in load(StructureNDTStatusRecord):
            types = ",".join(_split_types(row.ndt_type))
            identifiers = {
                "joint_no": _bounded(row.joint_no),
                "draw_no": _bounded(row.draw_no),
                "ndt_type": types,
                "ndt_report_no": _bounded(row.ndt_report_no),
                "welder_no": _bounded(row.welder_no),
            }
            documents.append(RagDocument(
                citation_id=f"ndt_status:{row.id}",
                entity="ndt_status",
                record_id=row.id,
                label=f"NDT status {row.id} / joint {_bounded(row.joint_no)} / {types}",
                text=_doc_text([
                    _text_part("NDT status joint", row.joint_no),
                    _text_part("drawing", row.draw_no),
                    _text_part("category", row.structure_category),
                    _text_part("page", row.page_no),
                    _text_part("block", row.block_no),
                    _text_part("method", types),
                    _text_part("report", row.ndt_report_no),
                    _text_part("result", row.ndt_result),
                    _text_part("welder", row.welder_no),
                    _text_part("weld length", row.weld_length),
                    _text_part("rejected length", row.rejected_length),
                ]),
                identifiers={key: value for key, value in identifiers.items() if value},
            ))

        for row in load(NDTTest):
            identifiers = {
                "method": _enum_value(row.method) or "",
                "report_no": _bounded(row.report_no),
            }
            documents.append(RagDocument(
                citation_id=f"ndt_test:{row.id}",
                entity="ndt_test",
                record_id=row.id,
                label=f"NDT test {row.id} / {_enum_value(row.method) or ''}",
                text=_doc_text([
                    _text_part("NDT test method", _enum_value(row.method)),
                    _text_part("result", row.result),
                    _text_part("report", row.report_no),
                    _text_part("test length", row.test_length),
                    _text_part("weld length", row.weld_length),
                ]),
                identifiers={key: value for key, value in identifiers.items() if value},
            ))

        for row in load(WPSRegister):
            identifiers = {"wps_no": _bounded(row.wps_no)}
            documents.append(RagDocument(
                citation_id=f"wps:{row.id}",
                entity="wps_register",
                record_id=row.id,
                label=f"WPS {_bounded(row.wps_no)}",
                text=_doc_text([
                    _text_part("WPS", row.wps_no),
                    _text_part("process", row.process),
                    _text_part("position", row.position),
                    _text_part("material group", row.material_group),
                    _text_part("thickness range", row.thickness_range),
                    _text_part("status", row.status),
                ]),
                identifiers={key: value for key, value in identifiers.items() if value},
            ))

        for row in load(WelderRegister):
            identifiers = {"welder_no": _bounded(row.welder_no)}
            documents.append(RagDocument(
                citation_id=f"welder:{row.id}",
                entity="welder_register",
                record_id=row.id,
                label=f"Welder {_bounded(row.welder_no)}",
                text=_doc_text([
                    _text_part("Welder", row.welder_no),
                    _text_part("qualification", row.qualification),
                    _text_part("qualified material", row.qualified_material),
                    _text_part("process", row.weld_process),
                    _text_part("position", row.qualified_position),
                    _text_part("validity", row.validity),
                    _text_part("status", row.status),
                ]),
                identifiers={key: value for key, value in identifiers.items() if value},
            ))

        return [document.as_dict() for document in documents[:limit]]

    # ---------- ranking ----------

    @staticmethod
    def _document_tokens(document: Dict[str, Any]) -> List[str]:
        tokens = tokenize(document["text"])
        weighted = tokenize(document["label"])
        for value in document.get("identifiers", {}).values():
            id_tokens = identifier_tokens(str(value))
            weighted.extend(id_tokens * 3)
        return tokens + weighted

    def search(
        self,
        project_id: int,
        query: str,
        top_k: int = AI_RAG_TOP_K,
        source_types: Optional[Sequence[str]] = None,
    ) -> List[Dict[str, Any]]:
        documents = get_project_documents(self.db, project_id)
        if source_types:
            allowed = {item.casefold() for item in source_types}
            documents = [doc for doc in documents if doc["entity"].casefold() in allowed]
        if not documents or not normalize_text(query):
            return []

        doc_tokens = [self._document_tokens(doc) for doc in documents]
        query_tokens = [token for token in tokenize(query) if token not in _STOPWORDS]
        if not query_tokens:
            query_tokens = tokenize(query)
        if not query_tokens:
            return []

        n_docs = len(documents)
        avgdl = sum(len(tokens) for tokens in doc_tokens) / n_docs if n_docs else 0.0
        df = Counter()
        for tokens in doc_tokens:
            for token in set(tokens):
                df[token] += 1

        k1, b = 1.5, 0.75
        query_identifiers = [
            token for token in query_tokens if any(char.isdigit() for char in token) and len(token) >= 3
        ]
        results: List[Tuple[float, Dict[str, Any]]] = []
        for document, tokens in zip(documents, doc_tokens):
            counts = Counter(tokens)
            length = len(tokens) or 1
            score = 0.0
            for token in query_tokens:
                frequency = counts.get(token, 0)
                if not frequency:
                    continue
                idf = math.log(1 + (n_docs - df[token] + 0.5) / (df[token] + 0.5))
                score += idf * (frequency * (k1 + 1)) / (
                    frequency + k1 * (1 - b + b * length / (avgdl or 1))
                )
            score += _identifier_boost(query_identifiers, document)
            if score > 0:
                enriched = dict(document)
                enriched["score"] = round(score, 4)
                results.append((score, enriched))

        results.sort(key=lambda item: item[0], reverse=True)
        return [document for _, document in results[: max(1, top_k)]]


def _identifier_boost(query_identifiers: Sequence[str], document: Dict[str, Any]) -> float:
    if not query_identifiers:
        return 0.0
    boost = 0.0
    values = [str(value).casefold() for value in document.get("identifiers", {}).values()]
    values += [token.casefold() for token in tokenize(document.get("text", ""))]
    for query_identifier in query_identifiers:
        query = query_identifier.casefold()
        for value in values:
            if not value:
                continue
            if query == value:
                boost += 5.0
            elif query in value or value in query:
                boost += 2.0
            elif len(query) >= 4 and difflib.SequenceMatcher(None, query, value).ratio() >= 0.88:
                boost += 1.0
                break
    return boost


# ---------- per-project cache ----------

_DOC_CACHE: Dict[int, Tuple[float, List[Dict[str, Any]]]] = {}
_AI_RAG_CACHE_MAX = max(1, int(os.getenv("AI_RAG_CACHE_MAX_PROJECTS", "32")))


def get_project_documents(db: Session, project_id: int) -> List[Dict[str, Any]]:
    now = monotonic()
    cached = _DOC_CACHE.get(project_id)
    if cached and now - cached[0] < AI_RAG_CACHE_TTL:
        return cached[1]
    for key, (generated_at, _) in list(_DOC_CACHE.items()):
        if now - generated_at >= AI_RAG_CACHE_TTL:
            _DOC_CACHE.pop(key, None)
    if len(_DOC_CACHE) >= _AI_RAG_CACHE_MAX:
        oldest = min(_DOC_CACHE.items(), key=lambda item: item[1][0])[0]
        _DOC_CACHE.pop(oldest, None)
    documents = RagService(db).build_documents(project_id)
    _DOC_CACHE[project_id] = (now, documents)
    return documents


def clear_rag_cache(project_id: Optional[int] = None) -> None:
    if project_id is None:
        _DOC_CACHE.clear()
    else:
        _DOC_CACHE.pop(project_id, None)
