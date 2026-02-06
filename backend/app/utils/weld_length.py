"""
Utility functions for weld length calculations.
"""

import re
import math

def parse_diameter(diameter_str: str) -> float:
    """
    Parse diameter string to millimeters.
    
    Supports formats:
    - "12\"" (inches)
    - "300mm" (millimeters)
    - "12 in" (inches)
    - "12 inch" (inches)
    - "12" (assumed inches if no unit)
    
    Args:
        diameter_str: String representation of diameter
        
    Returns:
        Diameter in millimeters as float
    """
    if not diameter_str:
        return 0.0
    
    # Clean the string
    s = str(diameter_str).strip().lower()
    
    # Remove any extra spaces
    s = re.sub(r'\s+', ' ', s)
    
    # Try to parse as inches
    inch_match = re.search(r'([\d\.]+)\s*(?:"|in|inch|inches)', s)
    if inch_match:
        inches = float(inch_match.group(1))
        return inches * 25.4  # Convert inches to mm
    
    # Try to parse as millimeters
    mm_match = re.search(r'([\d\.]+)\s*(?:mm|millimeters?)', s)
    if mm_match:
        return float(mm_match.group(1))
    
    # Try to parse as just a number (assume inches if < 32, mm if >= 32)
    num_match = re.search(r'([\d\.]+)', s)
    if num_match:
        num = float(num_match.group(1))
        # Heuristic: if number < 32, assume inches (pipe diameters), otherwise mm
        if num < 32:
            return num * 25.4
        else:
            return num
    
    return 0.0

def calculate_weld_length_from_diameter(diameter_str: str) -> float:
    """
    Calculate weld length (circumference) from pipe diameter.
    
    Formula: circumference = π × diameter
    
    Args:
        diameter_str: String representation of diameter
        
    Returns:
        Weld length in millimeters, or 0 if diameter cannot be parsed
    """
    diameter_mm = parse_diameter(diameter_str)
    if diameter_mm <= 0:
        return 0.0
    
    # Calculate circumference
    circumference = math.pi * diameter_mm
    
    # Round to 1 decimal place
    return round(circumference, 1)

def validate_weld_length(actual_length: float, diameter_str: str, tolerance_percent: float = 0.1) -> dict:
    """
    Validate if actual weld length matches expected circumference.
    
    Args:
        actual_length: Actual weld length in mm
        diameter_str: Pipe diameter string
        tolerance_percent: Allowed percentage difference (default 0.1%)
        
    Returns:
        Dictionary with validation results
    """
    expected_length = calculate_weld_length_from_diameter(diameter_str)
    
    if expected_length <= 0:
        return {
            'is_valid': True,  # No diameter to validate against
            'calculated_length': 0,
            'difference': 0,
            'percentage_diff': 0,
            'message': 'No pipe diameter provided for validation'
        }
    
    difference = abs(actual_length - expected_length)
    percentage_diff = (difference / expected_length) * 100 if expected_length > 0 else 0
    
    is_valid = percentage_diff <= tolerance_percent
    
    message = ""
    if is_valid:
        message = f"Weld length matches pipe diameter circumference (expected: {expected_length:.1f}mm)"
    else:
        message = f"Weld length differs from pipe diameter circumference by {percentage_diff:.1f}% (expected: {expected_length:.1f}mm, actual: {actual_length}mm)"
    
    return {
        'is_valid': is_valid,
        'calculated_length': expected_length,
        'difference': difference,
        'percentage_diff': percentage_diff,
        'message': message
    }

def is_pipe_project(project_type: str) -> bool:
    """
    Check if project type is pipe (as opposed to structure).
    
    Args:
        project_type: Project type string
        
    Returns:
        True if project type is 'pipe', False otherwise
    """
    return str(project_type).lower() == 'pipe'
