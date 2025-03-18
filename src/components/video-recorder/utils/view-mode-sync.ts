import { ViewMode } from '../types';
import { videoTrackProcessor } from './video-track-processor';

/**
 * Utilities to ensure view mode changes are captured properly in recordings
 */
export const syncViewModeChange = (newMode: ViewMode, stream: MediaStream | null): void => {
  if (!stream) {
    console.warn('Cannot sync view mode - no stream provided');
    return;
  }
  
  console.log(`Syncing view mode change to ${newMode}`);
  
  // Force multiple updates to ensure the change is captured
  const delays = [10, 50, 100, 200, 400, 800];
  
  delays.forEach(delay => {
    setTimeout(() => {
      if (stream) {
        videoTrackProcessor.pulseTrack(stream);
      }
    }, delay);
  });
  
  // Dispatch a view mode change event that other components can listen for
  window.dispatchEvent(new CustomEvent('recorder:viewModeChanged', { 
    detail: { 
      viewMode: newMode,
      timestamp: Date.now()
    }
  }));
}; 