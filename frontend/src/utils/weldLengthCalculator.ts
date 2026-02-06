/**
 * Utility functions for calculating and validating weld length from pipe diameter
 * Formula: weld length = π × pipe diameter × 25.4 (for inches) or × 1 (for mm)
 * Returns circumference of pipe joint in mm
 */

/**
 * Calculate weld length from pipe diameter string
 * @param dia Pipe diameter string (e.g., "12\"", "300mm", "12", "300")
 * @returns Calculated weld length in mm, or undefined if cannot calculate
 */
export const calculateWeldLengthFromDiameter = (dia: string | null | undefined): number | undefined => {
  if (!dia) return undefined;
  
  // Extract numeric value from string
  const match = dia.match(/([0-9]+(?:\.[0-9]+)?)/);
  const value = match ? parseFloat(match[1]) : 0;
  if (!value || isNaN(value)) return undefined;
  
  // Determine conversion factor: 25.4 for inches, 1 for mm
  // Unitless numbers < 32 are assumed to be inches (pipe diameters)
  const hasInchIndicator = dia.includes('"') || dia.toLowerCase().includes('inch');
  const hasMmIndicator = dia.toLowerCase().includes('mm');
  const isInches = hasInchIndicator || (!hasMmIndicator && value < 32);
  const factor = isInches ? 25.4 : 1;
  
  // Calculate circumference: π × diameter × conversion factor
  const circumference = Math.PI * value * factor;
  
  // Round to 3 decimal places
  return parseFloat(circumference.toFixed(3));
};

/**
 * Validate if weld length matches calculated circumference within tolerance
 * @param weldLength Actual weld length in mm
 * @param pipeDia Pipe diameter string
 * @param tolerance Tolerance in mm (default: 0.1mm for manual adjustments)
 * @returns Object with validation result and details
 */
export const validateWeldLength = (
  weldLength: number | null | undefined, 
  pipeDia: string | null | undefined,
  tolerance: number = 0.1
): { 
  isValid: boolean; 
  calculatedLength?: number; 
  difference?: number;
  percentageDiff?: number;
  message: string;
} => {
  // If no pipe diameter, cannot validate
  if (!pipeDia) {
    return {
      isValid: true,
      message: 'No pipe diameter provided for validation'
    };
  }
  
  // If no weld length, consider invalid
  if (weldLength === null || weldLength === undefined) {
    return {
      isValid: false,
      message: 'Weld length is required'
    };
  }
  
  // Calculate expected weld length
  const calculatedLength = calculateWeldLengthFromDiameter(pipeDia);
  
  // If cannot calculate, cannot validate
  if (calculatedLength === undefined) {
    return {
      isValid: true,
      message: 'Cannot calculate from pipe diameter format'
    };
  }
  
  // Calculate difference and percentage
  const difference = Math.abs(weldLength - calculatedLength);
  const percentageDiff = calculatedLength > 0 ? (difference / calculatedLength) * 100 : 100;
  
  // Determine validation result based on tolerance
  const isValid = difference <= tolerance;
  
  let message = '';
  if (isValid) {
    if (difference === 0) {
      message = 'Weld length matches calculated circumference';
    } else {
      message = `Weld length is within tolerance (±${tolerance}mm) of calculated circumference`;
    }
  } else {
    message = `Weld length differs from calculated circumference by ${difference.toFixed(2)}mm (${percentageDiff.toFixed(1)}%)`;
  }
  
  return {
    isValid,
    calculatedLength,
    difference,
    percentageDiff,
    message
  };
};

/**
 * Format pipe diameter for display with unit
 * @param dia Pipe diameter string
 * @returns Formatted string with unit
 */
export const formatPipeDiameter = (dia: string | null | undefined): string => {
  if (!dia) return '';
  
  if (dia.includes('"')) {
    return dia.replace('"', '"');
  } else if (dia.toLowerCase().includes('mm')) {
    return dia;
  } else {
    // Check if it's likely inches or mm based on value
    const match = dia.match(/([0-9]+(?:\.[0-9]+)?)/);
    const value = match ? parseFloat(match[1]) : 0;
    
    if (value < 50) {
      // Small values likely inches
      return `${value}"`;
    } else {
      // Larger values likely mm
      return `${value}mm`;
    }
  }
};

/**
 * Extract numeric value from pipe diameter string
 * @param dia Pipe diameter string
 * @returns Numeric value in mm
 */
export const extractDiameterValue = (dia: string | null | undefined): number | undefined => {
  if (!dia) return undefined;
  
  const match = dia.match(/([0-9]+(?:\.[0-9]+)?)/);
  const value = match ? parseFloat(match[1]) : 0;
  if (!value || isNaN(value)) return undefined;
  
  const isInches = dia.includes('"') || dia.toLowerCase().includes('inch');
  return isInches ? value * 25.4 : value;
};

/**
 * Check if a project is a pipe project
 * @param projectType Project type from project object
 * @returns True if pipe project
 */
export const isPipeProject = (projectType: string | undefined): boolean => {
  return projectType === 'pipe';
};
