"""
NDT Report Number Validator and Formatter

This module provides functions to validate and format NDT report numbers
according to the required format: {NDT_TYPE}-REPORT-{SERIAL_NO}

Examples:
- RT-REPORT-0015
- UT-REPORT-0013
- MPI-REPORT-0015
- PT-REPORT-0015
- MT-REPORT-0001
- PAUT-REPORT-0001
- FT-REPORT-0001
- PMI-REPORT-0001
"""

import re
from typing import Optional, Tuple, List

# Valid NDT types
VALID_NDT_TYPES = ['RT', 'UT', 'MPI', 'PT', 'MT', 'PAUT', 'FT', 'PMI']

# Regex pattern for valid NDT report numbers
# Format: {NDT_TYPE}-REPORT-{SERIAL_NO}
# Where NDT_TYPE is 2-4 uppercase letters, SERIAL_NO is 1-4 digits
NDT_REPORT_PATTERN = re.compile(r'^([A-Z]{2,4})-REPORT-(\d{1,4})$', re.IGNORECASE)

def validate_ndt_report_number(report_no: str, ndt_type: Optional[str] = None) -> Tuple[bool, str]:
    """
    Validate an NDT report number.
    
    Args:
        report_no: The report number to validate
        ndt_type: Optional NDT type to check against (e.g., 'RT', 'UT', 'MPI')
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not report_no or report_no.strip() == '':
        return True, ""  # Empty is allowed (for pending tests)
    
    report_no = report_no.strip()
    
    # Check if it's already in the correct format
    match = NDT_REPORT_PATTERN.match(report_no)
    if not match:
        return False, f"Invalid NDT report number format. Expected format: 'NDT_TYPE-REPORT-SERIAL_NO' (e.g., 'RT-REPORT-0015')"
    
    found_type, serial_no = match.groups()
    found_type = found_type.upper()
    
    # Validate NDT type
    if found_type not in VALID_NDT_TYPES:
        valid_types_str = ', '.join(VALID_NDT_TYPES)
        return False, f"Invalid NDT type '{found_type}'. Valid types are: {valid_types_str}"
    
    # Check if ndt_type parameter matches the report number type
    if ndt_type and ndt_type.upper() != found_type:
        return False, f"NDT report number type '{found_type}' doesn't match NDT type '{ndt_type}'"
    
    # Validate serial number (should be numeric)
    try:
        serial_int = int(serial_no)
        if serial_int <= 0:
            return False, f"Serial number must be positive (got {serial_no})"
    except ValueError:
        return False, f"Invalid serial number '{serial_no}'. Must be numeric."
    
    return True, ""

def format_ndt_report_number(ndt_type: str, serial_no: str) -> str:
    """
    Format an NDT report number from NDT type and serial number.
    
    Args:
        ndt_type: NDT type (e.g., 'RT', 'UT', 'MPI')
        serial_no: Serial number (can be string or integer)
    
    Returns:
        Formatted NDT report number
    """
    ndt_type = ndt_type.upper().strip()
    
    # Validate NDT type
    if ndt_type not in VALID_NDT_TYPES:
        raise ValueError(f"Invalid NDT type '{ndt_type}'. Valid types are: {', '.join(VALID_NDT_TYPES)}")
    
    # Format serial number
    try:
        serial_int = int(str(serial_no).strip())
        if serial_int <= 0:
            raise ValueError(f"Serial number must be positive (got {serial_no})")
        serial_str = f"{serial_int:04d}"  # Pad to 4 digits
    except ValueError as e:
        raise ValueError(f"Invalid serial number '{serial_no}': {e}")
    
    return f"{ndt_type}-REPORT-{serial_str}"

def extract_ndt_report_info(report_no: str) -> Optional[Tuple[str, str]]:
    """
    Extract NDT type and serial number from a report number.
    
    Args:
        report_no: NDT report number
    
    Returns:
        Tuple of (ndt_type, serial_no) or None if invalid
    """
    if not report_no:
        return None
    
    match = NDT_REPORT_PATTERN.match(report_no.strip())
    if not match:
        return None
    
    ndt_type, serial_no = match.groups()
    return ndt_type.upper(), serial_no

def is_valid_ndt_report_number(report_no: str) -> bool:
    """
    Check if a report number is valid.
    
    Args:
        report_no: Report number to check
    
    Returns:
        True if valid, False otherwise
    """
    is_valid, _ = validate_ndt_report_number(report_no)
    return is_valid

def suggest_correction(report_no: str) -> Optional[str]:
    """
    Suggest a correction for an invalid NDT report number.
    
    Args:
        report_no: Invalid report number
    
    Returns:
        Suggested correction or None if no suggestion
    """
    if not report_no:
        return None
    
    report_no = report_no.strip().upper()
    
    # Common patterns to fix
    patterns = [
        # Fix missing "REPORT" part
        (r'^([A-Z]{2,4})-(\d{1,4})$', lambda m: f"{m.group(1)}-REPORT-{m.group(2).zfill(4)}"),
        # Fix lowercase
        (r'^([a-z]{2,4})-report-(\d{1,4})$', lambda m: f"{m.group(1).upper()}-REPORT-{m.group(2).zfill(4)}"),
        # Fix "NDT-" prefix
        (r'^NDT-([A-Z]{2,4})-(\d{1,4})$', lambda m: f"{m.group(1)}-REPORT-{m.group(2).zfill(4)}"),
        # Fix "NDT-STATUS-" prefix
        (r'^NDT-STATUS-(\d{1,4})$', lambda m: f"RT-REPORT-{m.group(1).zfill(4)}"),  # Default to RT
    ]
    
    for pattern, replacement in patterns:
        match = re.match(pattern, report_no, re.IGNORECASE)
        if match:
            try:
                return replacement(match)
            except:
                continue
    
    return None

def get_next_serial_number(existing_reports: List[str], ndt_type: str) -> str:
    """
    Get the next serial number for a given NDT type.
    
    Args:
        existing_reports: List of existing report numbers
        ndt_type: NDT type
    
    Returns:
        Next serial number as string (padded to 4 digits)
    """
    ndt_type = ndt_type.upper()
    max_serial = 0
    
    for report in existing_reports:
        if not report:
            continue
        
        info = extract_ndt_report_info(report)
        if info and info[0] == ndt_type:
            try:
                serial = int(info[1])
                max_serial = max(max_serial, serial)
            except ValueError:
                continue
    
    return f"{max_serial + 1:04d}"

def auto_generate_report_number(ndt_type: str, existing_reports: List[str]) -> str:
    """
    Auto-generate a report number for an NDT type.
    
    Args:
        ndt_type: NDT type
        existing_reports: List of existing report numbers
    
    Returns:
        Auto-generated report number
    """
    next_serial = get_next_serial_number(existing_reports, ndt_type)
    return format_ndt_report_number(ndt_type, next_serial)