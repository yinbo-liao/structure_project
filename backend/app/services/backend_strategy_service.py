from typing import Any, Dict, List, Optional


class BackendStrategyService:
    """Builds backend-oriented implementation strategy documents and capability metadata."""

    def get_capabilities(self) -> List[Dict[str, Any]]:
        return [
            {
                "key": "web_reading",
                "title": "Web Reading",
                "summary": "Collect external content and convert it into structured backend-ready context.",
                "backend_support": "Expose ingestion endpoints, normalize fetched content, and persist analysis requests.",
                "suggested_files": [
                    "app/routes/ai.py",
                    "app/services/backend_strategy_service.py",
                    "app/schemas.py",
                ],
                "deliverables": ["content summaries", "context payloads", "review-ready notes"],
            },
            {
                "key": "research_analysis",
                "title": "Research And Analysis",
                "summary": "Turn raw project or inspection data into actionable analysis for users.",
                "backend_support": "Create analysis routes, shared prompt builders, and structured responses for frontend consumption.",
                "suggested_files": [
                    "app/routes/ai.py",
                    "app/routes/projects.py",
                    "app/schemas.py",
                ],
                "deliverables": ["analysis summaries", "findings", "recommendations"],
            },
            {
                "key": "data_mining",
                "title": "Data Mining",
                "summary": "Aggregate operational data and produce trends or derived metrics.",
                "backend_support": "Reuse SQLAlchemy queries and pandas transforms to produce durable metrics APIs.",
                "suggested_files": [
                    "app/routes/projects.py",
                    "app/routes/structure_inspections.py",
                    "app/services/backend_strategy_service.py",
                ],
                "deliverables": ["trend reports", "dashboard metrics", "export datasets"],
            },
            {
                "key": "content_creation",
                "title": "Content Creation",
                "summary": "Generate polished text outputs from structured project context.",
                "backend_support": "Provide templated generation endpoints and consistent response schemas for downstream UI/export.",
                "suggested_files": [
                    "app/routes/ai.py",
                    "app/schemas.py",
                ],
                "deliverables": ["professional summaries", "status reports", "deliverable drafts"],
            },
        ]

    def build_local_backend_strategy(
        self,
        focus_area: str,
        desired_outputs: List[str],
        target_files: Optional[List[str]] = None,
        constraints: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        target_files = target_files or [
            "app/routes/ai.py",
            "app/services/backend_strategy_service.py",
            "app/schemas.py",
        ]
        constraints = constraints or []

        implementation_steps = [
            "Define explicit request/response schemas so the frontend can consume strategy outputs safely.",
            "Move capability and planning logic into a dedicated service to keep route handlers thin.",
            "Expose authenticated strategy endpoints under the existing AI router for reuse by frontend or scripts.",
            "Return structured deliverables rather than plain text so results can be rendered, exported, or audited.",
            "Keep fallback behavior deterministic so the backend still works without an external AI provider.",
        ]

        backend_file_plan = [
            {
                "file": "app/schemas.py",
                "purpose": "Define capability and strategy response contracts.",
            },
            {
                "file": "app/services/backend_strategy_service.py",
                "purpose": "Centralize strategy/capability generation and local backend file mapping.",
            },
            {
                "file": "app/routes/ai.py",
                "purpose": "Expose the strategy endpoints through the current AI API surface.",
            },
        ]

        deliverables = desired_outputs or [
            "capability manifest",
            "implementation roadmap",
            "backend file plan",
        ]

        return {
            "title": f"Local Backend Strategy For {focus_area}",
            "overview": (
                "Implement the linked capability strategy through structured backend services, "
                "typed schemas, and reusable AI-oriented endpoints in the local codebase."
            ),
            "focus_area": focus_area,
            "desired_outputs": deliverables,
            "constraints": constraints,
            "implementation_steps": implementation_steps,
            "backend_file_plan": backend_file_plan,
            "target_files": target_files,
        }
