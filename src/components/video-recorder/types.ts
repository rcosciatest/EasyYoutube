import React from 'react';
// import RecordRTC from 'recordrtc';

// Core types
export type RecordingState = 'idle' | 'recording' | 'paused' | 'processing';
export type ViewMode = 'full' | 'split' | 'circle' | 'tutorial';
export type TeleprompterPosition = 'overlay' | 'side' | 'bottom';
export type PlayerState = 'loading' | 'video' | 'audio' | 'error';

// Interfaces
export interface VideoRecorderProps {
  script?: string[];
}

export interface StreamsContextType {
  webcamStream: MediaStream | null;
  screenStream: MediaStream | null;
  canvasStream: MediaStream | null;
  viewMode: ViewMode;
  toggleViewMode: (mode: ViewMode) => Promise<void>;
  startScreenCapture: () => Promise<MediaStream | null>;
  ensureVideoStreamsAvailable: () => void;
}

export interface RecordingContextType {
  recordingState: RecordingState;
  recordingDuration: number;
  recordedChunks: Blob[];
  videoUrl: string | null;
  videoBlob: Blob | null;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  resetRecording: () => void;
}

// Extended type for canvas context with roundRect
export type CanvasRenderingContext2DExtended = CanvasRenderingContext2D & {
  // Define roundRect as an optional property to handle both cases
  // This avoids TypeScript errors while still allowing the method to be used when available
  roundRect?: (
    x: number, 
    y: number, 
    w: number, 
    h: number, 
    radii?: number | DOMPointInit | (number | DOMPointInit)[] | undefined
  ) => void;
};

// Helper function to check if context has roundRect method
export const hasRoundRect = (ctx: CanvasRenderingContext2D): ctx is CanvasRenderingContext2D & { 
  roundRect: NonNullable<CanvasRenderingContext2DExtended['roundRect']> 
} => {
  return 'roundRect' in ctx;
};

// Media streams hook interfaces
export interface UseMediaStreamsResult {
  webcamStream: MediaStream | null;
  screenStream: MediaStream | null;
  webcamVideoRef: React.RefObject<HTMLVideoElement | null>;
  screenVideoRef: React.RefObject<HTMLVideoElement | null>;
  circleWebcamRef: React.RefObject<HTMLVideoElement | null>;
  initializeWebcam: () => Promise<MediaStream>;
  initializeScreenCapture: () => Promise<MediaStream>;
  cleanupStreams: () => void;
}

// Recording hook interfaces
export interface UseRecordingProps {
  canvasStream: MediaStream | null;
  webcamStream: MediaStream | null;
}

export interface UseRecordingResult {
  recordingState: RecordingState;
  recordingDuration: number;
  videoUrl: string | null;
  videoBlob: Blob | null;
  error: string | null;
  recordedChunks: Blob[];
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  pauseRecording: () => void;
  isPaused: boolean;
}

// Recording controls props
export interface RecordingControlsProps {
  recordingState: RecordingState;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPauseRecording: () => void;
  isPaused: boolean;
  showTeleprompter: boolean;
  onToggleTeleprompter: () => void;
  videoUrl: string | null;
}

// Video player props
export interface VideoPlayerProps {
  videoUrl: string | null;
  videoBlob: Blob | null;
  hideDownloadButton?: boolean;
}

// Move the module declaration to a separate declaration file
// Remove the RecordRTC module declaration from here 