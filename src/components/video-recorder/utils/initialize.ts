import { applyCanvasPolyfills } from './canvas-polyfill';

// Apply all polyfills and initialization
export const initializeVideoRecorder = () => {
  // Apply canvas roundRect polyfill
  applyCanvasPolyfills();
  
  // Log browser capabilities for debugging
  console.log("Browser capabilities:");
  console.log("- MediaRecorder:", typeof MediaRecorder !== 'undefined');
  
  // Check codec support
  if (typeof MediaRecorder !== 'undefined') {
    const codecs = [
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9,opus', 
      'video/webm;codecs=h264,opus'
    ];
    codecs.forEach(codec => {
      console.log(`- ${codec}: ${MediaRecorder.isTypeSupported(codec)}`);
    });
  }
}; 