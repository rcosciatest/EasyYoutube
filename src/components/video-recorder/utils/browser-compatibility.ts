/**
 * Utility to check browser compatibility with required features
 */

interface CompatibilityResult {
  compatible: boolean;
  issues: string[];
}

export const checkBrowserCompatibility = (): CompatibilityResult => {
  const issues: string[] = [];
  
  // Check for getUserMedia support
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    issues.push('Camera and microphone access not supported');
  }
  
  // Check for MediaRecorder support
  if (typeof MediaRecorder === 'undefined') {
    issues.push('MediaRecorder API not supported');
  }
  
  // Check for canvas.captureStream support
  const canvas = document.createElement('canvas');
  if (!canvas.captureStream) {
    issues.push('Canvas capture not supported');
  }
  
  // Check for screen capture support
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    issues.push('Screen capture not supported');
  }
  
  // Check for WebM support
  const hasWebmSupport = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus');
  if (!hasWebmSupport) {
    issues.push('WebM video format not supported');
  }
  
  return {
    compatible: issues.length === 0,
    issues
  };
}; 