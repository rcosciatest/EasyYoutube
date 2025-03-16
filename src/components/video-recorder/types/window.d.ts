interface Window {
  _directAudioStream: MediaStream | null | undefined;
  _mediaRecorderInstance: MediaRecorder | null | undefined;
  _lastViewMode: string | undefined;
  _audioTracksAdded: number | undefined;
  _pendingAudioPromise: Promise<MediaStream | null> | null | undefined;
} 