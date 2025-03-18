/**
 * Media error handling utilities
 */

/**
 * Process errors from getUserMedia and other media APIs into user-friendly messages
 */
export const handleMediaError = (error: any, context: string = 'media'): string => {
  console.error(`Media error in ${context}:`, error);
  
  // Handle standard DOM exceptions
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotFoundError':
        return 'Camera or microphone not found. Please connect a device and try again.';
        
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'Permission denied. Please allow access to your camera and microphone.';
        
      case 'OverconstrainedError':
        return 'Your device does not meet the required constraints. Try a different device.';
        
      case 'NotReadableError':
      case 'AbortError':
        return 'Could not access your camera or microphone. Please check if another application is using them.';
        
      case 'SecurityError':
        return 'Security error. Media access is not allowed in this context.';
        
      default:
        return `Media error: ${error.name}. Please try again.`;
    }
  }
  
  // Handle other error types
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && error.message) {
    return error.message;
  }
  
  return `Unknown error during ${context}. Please try again.`;
}; 