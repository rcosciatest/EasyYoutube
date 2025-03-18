// This file consolidates and fixes all window interface type issues

// The globally accessible properties on window
declare global {
  interface Window {
    // Use null union types to allow explicit null assignment
    _directAudioStream: MediaStream | null | undefined;
    _mediaRecorderInstance: MediaRecorder | null | undefined;
    _lastViewMode: string | undefined;
    _audioTracksAdded: number | undefined;
    _pendingAudioPromise: Promise<MediaStream | null> | null | undefined;
    _webcamStream?: MediaStream;
  }
  
  // Add Navigator interface extension inside the global scope
  interface Navigator {
    msSaveOrOpenBlob?: (blob: Blob, defaultName?: string) => boolean;
  }
}

// Helper functions to safely access window properties with proper types
export const getDirectAudioStream = (): MediaStream | null => {
  return window._directAudioStream || null;
};

export const setDirectAudioStream = (stream: MediaStream | null): void => {
  window._directAudioStream = stream;
};

export const getMediaRecorderInstance = (): MediaRecorder | null => {
  return window._mediaRecorderInstance || null;
};

export const setMediaRecorderInstance = (recorder: MediaRecorder | null): void => {
  window._mediaRecorderInstance = recorder;
};

export const getLastViewMode = (): string => {
  return window._lastViewMode || 'full';
};

export const setLastViewMode = (mode: string): void => {
  window._lastViewMode = mode;
};

export const getAudioTracksAdded = (): number => {
  return window._audioTracksAdded || 0;
};

export const setAudioTracksAdded = (count: number): void => {
  window._audioTracksAdded = count;
};

export const incrementAudioTracksAdded = (): number => {
  const current = getAudioTracksAdded();
  setAudioTracksAdded(current + 1);
  return current + 1;
};

// Export a utility to initialize window globals safely
export const initWindowGlobals = (): void => {
  if (typeof window !== 'undefined') {
    window._mediaRecorderInstance = window._mediaRecorderInstance || null;
    window._audioTracksAdded = window._audioTracksAdded || 0;
    window._directAudioStream = window._directAudioStream || null;
    window._pendingAudioPromise = window._pendingAudioPromise || null;
    window._lastViewMode = window._lastViewMode || 'full';
  }
};

// Initialize on import
initWindowGlobals();

export {}; 