from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
import httpx
import os
from app.database import get_db
from app.models import (
    User as UserModel,
    Project as ProjectModel,
    StructureFitUpInspection,
    StructureFinalInspection,
    StructureMaterialRegister
)
from app.schemas import AISummaryRequest, AISummaryResponse
from app.auth import get_current_user

router = APIRouter()

# DeepSeek chat integration
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY") or os.getenv("AI_API_KEY")
DEEPSEEK_API_URL = os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com/v1/chat/completions")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

async def generate_ai_summary(prompt: str, context_data: dict) -> str:
    """Generate AI summary using Qwen API"""
    if not DEEPSEEK_API_KEY:
        # Return mock summary if API key not configured
        return generate_mock_summary(context_data)
    
    try:
        # Prepare the prompt with context data
        context_summary = format_context_data(context_data)
        full_prompt = f"""
{prompt}

Context Data:
{context_summary}

Please provide a comprehensive analysis and summary.
"""
        
        headers = {
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": DEEPSEEK_MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": full_prompt
                }
            ],
            "temperature": 0.7,
            "max_tokens": 2000
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                DEEPSEEK_API_URL,
                headers=headers,
                json=payload,
                timeout=30.0
            )
            
            if response.status_code == 200:
                result = response.json()
                try:
                    return result["choices"][0]["message"]["content"]
                except Exception:
                    return generate_mock_summary(context_data)
            else:
                # Fallback to mock summary
                return generate_mock_summary(context_data)
                
    except Exception as e:
        # Log the error and return mock summary
        print(f"AI service error: {e}")
        return generate_mock_summary(context_data)

def format_context_data(context_data: dict) -> str:
    """Format context data for AI consumption"""
    formatted = ""
    for key, value in context_data.items():
        if isinstance(value, dict):
            formatted += f"{key}:\n"
            for sub_key, sub_value in value.items():
                formatted += f"  - {sub_key}: {sub_value}\n"
        elif isinstance(value, list):
            formatted += f"{key}: {len(value)} items\n"
            for item in value[:5]:  # Limit to first 5 items
                formatted += f"  - {item}\n"
        else:
            formatted += f"{key}: {value}\n"
    return formatted

def generate_mock_summary(context_data: dict) -> str:
    """Generate a mock summary for development/testing"""
    summary_parts = []
    
    # Analyze context data and generate insights
    if "project_summary" in context_data:
        proj_sum = context_data["project_summary"]
        summary_parts.append(f"Project Analysis for {proj_sum.get('project_name', 'Unknown Project')}:")
        summary_parts.append(f"- Total Joints: {proj_sum.get('total_joints', 0)}")
        summary_parts.append(f"- Fit-up Completion: {proj_sum.get('fitup_done', 0)} joints")
        summary_parts.append(f"- Final Inspection: {proj_sum.get('final_done', 0)} joints completed")
        
        # Calculate progress
        total_joints = proj_sum.get('total_joints', 1)
        fitup_done = proj_sum.get('fitup_done', 0)
        final_done = proj_sum.get('final_done', 0)
        
        fitup_progress = (fitup_done / total_joints) * 100 if total_joints > 0 else 0
        final_progress = (final_done / total_joints) * 100 if total_joints > 0 else 0
        
        summary_parts.append(f"- Overall Progress: {fitup_progress:.1f}% fit-up, {final_progress:.1f}% final")
    
    # Add weld quality analysis
    if "weld_quality" in context_data:
        weld_qual = context_data["weld_quality"]
        accept_length = weld_qual.get('weld_accept_length_total', 0)
        reject_length = weld_qual.get('weld_reject_length_total', 0)
        total_weld = accept_length + reject_length
        
        if total_weld > 0:
            success_rate = (accept_length / total_weld) * 100
            summary_parts.append(f"- Weld Quality: {success_rate:.1f}% success rate")
            summary_parts.append(f"- Total Weld Length: {total_weld:.1f}m")
    
    # Add material analysis
    if "material_status" in context_data:
        mat_status = context_data["material_status"]
        used = mat_status.get('material_used', 0)
        pending = mat_status.get('material_pending_inspection', 0)
        summary_parts.append(f"- Material Management: {used} pieces used, {pending} pending inspection")
    
    return "\n".join(summary_parts)

@router.post("/ai/summary", response_model=AISummaryResponse)
async def generate_project_summary(
    request: AISummaryRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Generate AI summary for project data"""
    
    # Extract project context from the request
    context_data = request.context_data
    
    try:
        # Generate AI summary
        ai_summary = await generate_ai_summary(request.prompt, context_data)
        
        # Parse insights and recommendations (simplified parsing)
        insights = extract_insights(ai_summary)
        recommendations = extract_recommendations(ai_summary)
        
        return AISummaryResponse(
            summary=ai_summary,
            insights=insights,
            recommendations=recommendations
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate AI summary: {str(e)}"
        )

@router.get("/ai/project-summary/{project_id}")
async def get_ai_project_summary(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Generate AI summary for a specific project"""
    
    # Verify project access
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if current_user.role != 'admin' and project not in current_user.assigned_projects:
        raise HTTPException(status_code=403, detail="Not authorized to access this project")
    
    # Collect project data for AI analysis
    context_data = {
        "project_summary": {
            "project_name": project.name,
            "project_code": project.code,
            "total_joints": len(project.master_joints),
            "fitup_done": len([j for j in project.master_joints if j.fitup_status == "done"]),
            "final_done": len([j for j in project.master_joints if j.final_status == "done"])
        },
        "material_status": {
            "total_materials": len(project.material_registers),
            "material_used": len([m for m in project.material_registers]),
            "material_pending_inspection": len([m for m in project.material_registers if m.inspection_status == "pending"])
        },
        "weld_quality": {
            "weld_accept_length_total": sum([f.weld_length or 0 for f in project.fitup_inspections if f.fit_up_result == "accepted"]),
            "weld_reject_length_total": sum([f.weld_length or 0 for f in project.fitup_inspections if f.fit_up_result == "rejected"])
        },
        "ndt_status": {
            "total_requests": len(project.ndt_requests),
            "pending_requests": len([n for n in project.ndt_requests if n.status == "pending"]),
            "approved_requests": len([n for n in project.ndt_requests if n.status == "approved"])
        }
    }
    
    prompt = f"Analyze the project status and provide insights for {project.name}"
    
    try:
        ai_summary = await generate_ai_summary(prompt, context_data)
        insights = extract_insights(ai_summary)
        recommendations = extract_recommendations(ai_summary)
        
        return AISummaryResponse(
            summary=ai_summary,
            insights=insights,
            recommendations=recommendations
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate project summary: {str(e)}"
        )

@router.get("/ai/inspection-summary/{inspection_id}")
async def get_ai_inspection_summary(
    inspection_id: int,
    inspection_type: str,  # fitup, final, material
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Generate AI summary for a specific inspection"""
    
    context_data = {}
    
    if inspection_type == "fitup":
        # Try to find in structure tables
        inspection = db.query(StructureFitUpInspection).filter(StructureFitUpInspection.id == inspection_id).first()
        if not inspection:
            raise HTTPException(status_code=404, detail="Fit-up inspection not found")
        
        # Check project access
        project = db.query(ProjectModel).filter(ProjectModel.id == inspection.project_id).first()
        if current_user.role != 'admin' and project not in current_user.assigned_projects:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
        
        context_data = {
            "inspection_type": "fitup",
            "joint_details": {
                "structure_category": inspection.structure_category,
                "drawing_no": inspection.draw_no,
                "block_no": inspection.block_no,
                "joint_no": inspection.joint_no,
                "weld_type": inspection.weld_type
            },
            "material_info": {
                "part1_piece_mark": inspection.part1_piece_mark_no,
                "part2_piece_mark": inspection.part2_piece_mark_no,
                "part1_material": inspection.part1_material_type,
                "part2_material": inspection.part2_material_type
            },
            "weld_details": {
                "weld_site": inspection.weld_site,
                "weld_length": inspection.weld_length,
                "thickness": getattr(inspection, 'part1_thickness', None),
                "result": inspection.fit_up_result
            }
        }
        
    elif inspection_type == "final":
        # Try to find in both pipe and structure tables
        inspection = db.query(PipeFinalInspection).filter(PipeFinalInspection.id == inspection_id).first()
        if not inspection:
            inspection = db.query(StructureFinalInspection).filter(StructureFinalInspection.id == inspection_id).first()
            if not inspection:
                raise HTTPException(status_code=404, detail="Final inspection not found")
        
        # Check project access
        project = db.query(ProjectModel).filter(ProjectModel.id == inspection.project_id).first()
        if current_user.role != 'admin' and project not in current_user.assigned_projects:
            raise HTTPException(status_code=403, detail="Not authorized to access this project")
        
        context_data = {
            "inspection_type": "final",
            "inspection_details": {
                "wps_no": inspection.wps_no,
                "welder_no": inspection.welder_no,
                "final_result": inspection.final_result,
                "ndt_type": inspection.ndt_type,
                "weld_length": inspection.weld_length
            }
        }
    
    else:
        raise HTTPException(status_code=400, detail="Invalid inspection type")
    
    prompt = f"Analyze this {inspection_type} inspection and provide quality insights"
    
    try:
        ai_summary = await generate_ai_summary(prompt, context_data)
        insights = extract_insights(ai_summary)
        recommendations = extract_recommendations(ai_summary)
        
        return AISummaryResponse(
            summary=ai_summary,
            insights=insights,
            recommendations=recommendations
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate inspection summary: {str(e)}"
        )

def extract_insights(summary_text: str) -> list:
    """Extract insights from AI summary text"""
    insights = []
    
    # Simple pattern matching for insights
    if "quality" in summary_text.lower():
        insights.append("Quality metrics analyzed")
    if "progress" in summary_text.lower():
        insights.append("Project progress identified")
    if "material" in summary_text.lower():
        insights.append("Material usage patterns detected")
    if "weld" in summary_text.lower():
        insights.append("Welding performance evaluated")
    
    return insights if insights else ["General analysis completed"]

def extract_recommendations(summary_text: str) -> list:
    """Extract recommendations from AI summary text"""
    recommendations = []
    
    # Simple pattern matching for recommendations
    if "improve" in summary_text.lower():
        recommendations.append("Consider process improvements")
    if "monitor" in summary_text.lower():
        recommendations.append("Implement enhanced monitoring")
    if "review" in summary_text.lower():
        recommendations.append("Schedule quality review")
    if "optimize" in summary_text.lower():
        recommendations.append("Optimize resource allocation")
    
    return recommendations if recommendations else ["Continue current practices"]
