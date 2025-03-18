export interface UseRecordingResult {
  recordingState: RecordingState;
  recordingDuration: number;
  videoUrl: string | null;
  videoBlob: Blob | null;
  error: string | null;
  recordedChunks: Blob[];
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  isPaused: boolean;
  handleViewChange: () => void;
}

export type RecordingState = 'idle' | 'recording' | 'paused' | 'completed'; 