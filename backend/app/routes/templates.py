from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import pandas as pd
import io
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/structure-material-v2.xlsx")
async def get_structure_material_template():
    """
    Generate and download an Excel template for Structure Material Register
    with all columns that match the table display.
    """
    logger.info("Generating structure material template with complete columns...")
    try:
        # Create a sample DataFrame with ALL columns that match the table
        # Note: The backend normalization handles both "Structure Category" and "Structure Categor"
        column_headers = [
            'Block no', 
            'Drawing No', 
            'Piece Mark No', 
            'Material Type', 
            'Grade', 
            'Thickness', 
            'Spec',  # Maps to structure_spec
            'Heat No', 
            'Material Report No', 
            'Structure Category',  # Correct spelling - backend handles both
            'Status',  # Maps to inspection_status
            'drawing_rev'  # Additional column for drawing revision
        ]
        
        # Add some sample data to guide the user
        data = [
            {
                'Block no': 'BLK001',
                'Drawing No': 'DRW-001',
                'Piece Mark No': 'PM-001',
                'Material Type': 'Plate',
                'Grade': 'A36',
                'Thickness': '10MM',
                'Spec': 'ASTM A36',
                'Heat No': 'HT-001',
                'Material Report No': 'MR-001',
                'Structure Category': 'type-i',
                'Status': 'pending',
                'drawing_rev': 'Rev A'
            },
            {
                'Block no': 'BLK002',
                'Drawing No': 'DRW-002',
                'Piece Mark No': 'PM-002',
                'Material Type': 'Plate',
                'Grade': 'A36',
                'Thickness': '12MM',
                'Spec': 'ASTM A36',
                'Heat No': 'HT-002',
                'Material Report No': 'MR-002',
                'Structure Category': 'type-ii',
                'Status': 'accepted',
                'drawing_rev': 'Rev B'
            },
            {
                'Block no': 'BLK003',
                'Drawing No': 'DRW-003',
                'Piece Mark No': 'PM-003',
                'Material Type': 'Plate',
                'Grade': 'A36',
                'Thickness': '15MM',
                'Spec': 'ASTM A572',
                'Heat No': 'HT-003',
                'Material Report No': 'MR-003',
                'Structure Category': 'Special',
                'Status': 'pending',
                'drawing_rev': 'Rev C'
            }
        ]
        
        df = pd.DataFrame(data, columns=column_headers)
        
        # Create an in-memory Excel file
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Template')
            
            # Auto-adjust column widths
            worksheet = writer.sheets['Template']
            for i, col in enumerate(df.columns):
                # Calculate optimal width
                max_length = max(
                    df[col].astype(str).map(len).max(),
                    len(col)
                ) + 2
                
                # Excel column letter (A, B, C...)
                col_letter = chr(65 + i)
                worksheet.column_dimensions[col_letter].width = max_length
                
        output.seek(0)
        
        response_headers = {
            'Content-Disposition': 'attachment; filename="structure_material_template_complete.xlsx"'
        }
        
        return StreamingResponse(
            output, 
            headers=response_headers, 
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        
    except Exception as e:
        logger.error(f"Failed to generate Excel template: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate template: {str(e)}")
