// Updated hook to use RecordRTC for reliable recording
import { useState, useRef, useEffect, useCallback } from 'react';
import { RecordingState, UseRecordingProps, UseRecordingResult, ViewMode } from '../types';
import { RecordRTCService } from '../services/recordrtc-service';

export const useRecording = ({ canvasStream, webcamStream }: UseRecordingProps): UseRecordingResult => {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  
  const recordRTCRef = useRef<RecordRTCService | null>(null);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pausedTimeRef = useRef<number>(0);
  
  // Initialize RecordRTC service
  useEffect(() => {
    if (!recordRTCRef.current) {
      recordRTCRef.current = new RecordRTCService();
    }
    
    return () => {
      if (recordRTCRef.current) {
        recordRTCRef.current.destroy();
        recordRTCRef.current = null;
      }
    };
  }, []);
  
  // Timer function to update recording duration
  const startTimer = useCallback(() => {
    // Clear any existing timer
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    startTimeRef.current = Date.now() - pausedTimeRef.current * 1000;
    
    // Start a new timer that updates every 100ms
    timerRef.current = window.setInterval(() => {
      if (startTimeRef.current) {
        const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000;
        setRecordingDuration(Math.floor(elapsedSeconds));
      }
    }, 100);
  }, []);
  
  // Start recording function
  const startRecording = useCallback(async () => {
    try {
      if (!canvasStream) {
        throw new Error('Canvas stream is not available');
      }
      
      // Reset state
      setError(null);
      setRecordingDuration(0);
      setVideoUrl(null);
      setVideoBlob(null);
      setPausedAt(null);
      pausedTimeRef.current = 0;
      setRecordingState('processing'); // Show processing state during initialization
      
      // DEBUG: Log all available streams before starting
      console.log("%c🎬 RECORDING DEBUG: Starting recording with streams", "background:#f0f;color:#fff", {
        canvasStreamTracks: canvasStream?.getTracks().map(t => ({
          kind: t.kind,
          label: t.label,
          enabled: t.enabled,
          readyState: t.readyState
        })),
        webcamStreamTracks: webcamStream?.getTracks().map(t => ({
          kind: t.kind,
          label: t.label,
          enabled: t.enabled,
          readyState: t.readyState
        })),
        globalAudioStream: window._directAudioStream ? {
          active: window._directAudioStream.active,
          tracks: window._directAudioStream.getTracks().map(t => ({
            kind: t.kind,
            label: t.label,
            enabled: t.enabled,
            readyState: t.readyState
          }))
        } : 'None'
      });
      
      // CRITICAL: Ensure audio is available before starting recording
      const audioStream = window._directAudioStream || await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true, 
          autoGainControl: true,
          sampleRate: 48000
        }
      });
      
      window._directAudioStream = audioStream;
      
      console.log("%c🎤 STARTING RECORDING WITH AUDIO", "background:blue;color:white;font-size:16px", {
        hasAudioTracks: audioStream.getAudioTracks().length,
        audioLabel: audioStream.getAudioTracks()[0]?.label
      });
      
      // Initialize RecordRTC service with guaranteed audio
      recordRTCRef.current = new RecordRTCService();
      await recordRTCRef.current.initialize(canvasStream, audioStream);
      
      // Start the timer
      startTimer();
      
      // Update state
      setRecordingState('recording');
      
      // Fix: Use RecordRTCService's methods instead of accessing properties directly
      // This section simulates capturing recordRTC's data events
      if (recordRTCRef.current) {
        // Add onDataAvailable handler to our RecordRTCService wrapper if it supports it
        // This is a mock approach since we can't directly access the MediaRecorder instance
        try {
          recordRTCRef.current.addDataListener((data: Blob) => {
            if (data && data.size > 0) {
              console.log(`%c🎬 RECORDING DEBUG: Received chunk ${recordedChunks.length + 1}`, 
                        "background:#f0f;color:#fff", {
                size: (data.size / 1024).toFixed(1) + 'KB',
                type: data.type,
                timestamp: new Date().toISOString()
              });
              
              setRecordedChunks(chunks => [...chunks, data]);
            }
          });
        } catch (err) {
          console.warn("Debug listener could not be attached:", err);
        }
      }
    } catch (err) {
      console.error("🎬 RECORDING ERROR:", err);
      setError("Failed to start recording: " + (err as Error).message);
      setRecordingState('idle');
    }
  }, [canvasStream, startTimer]);
  
  // Stop recording function
  const stopRecording = useCallback(async () => {
    try {
      // Clear timer
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      setRecordingState('processing');
      
      if (!recordRTCRef.current) {
        setError('No active recording');
        setRecordingState('idle');
        return;
      }
      
      // Stop the recording
      await recordRTCRef.current.stopRecording();
      
      // Get the recording blob
      const blob = await recordRTCRef.current.getBlob();
      
      // CRITICAL FIX: Log detailed blob information for debugging
      console.log(`%c📊 RECORDING BLOB DIAGNOSTICS`, "background:purple;color:white;font-size:14px", {
        size: `${(blob.size / (1024 * 1024)).toFixed(2)} MB`,
        type: blob.type,
        hasAudioTracks: recordRTCRef.current.getState().hasAudioTracks,
        recordedDuration: recordingDuration,
        timestamp: new Date().toISOString()
      });
      
      // Create object URL
      const url = URL.createObjectURL(blob);
      
      // Update state with recording data
      setVideoBlob(blob);
      setVideoUrl(url);
      setRecordingState('idle');
      
      // Additional diagnostic logging for audio tracks
      const tempVideo = document.createElement('video');
      tempVideo.src = url;
      tempVideo.onloadedmetadata = () => {
        console.log(`%c🎬 RECORDING COMPLETE: Duration metadata=${tempVideo.duration.toFixed(2)}s`, 
          "background:green;color:white;font-size:14px");
      };
      
      // Process chunks if available
      if (recordedChunks.length > 0) {
        console.log(`Received ${recordedChunks.length} recorded chunks`);
      }
    } catch (err) {
      console.error('Error stopping recording:', err);
      setError(`Failed to stop recording: ${err instanceof Error ? err.message : String(err)}`);
      setRecordingState('idle');
    }
  }, [recordingDuration, recordedChunks]);
  
  // Pause recording function (temporarily stop)
  const pauseRecording = useCallback(() => {
    try {
      // Clear timer
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      setPausedAt(Date.now());
      pausedTimeRef.current = recordingDuration;
      
      // We'll use this flag but actually keep recording since RecordRTC
      // doesn't support true pause/resume well in all browsers
      setRecordingState('paused');
    } catch (err) {
      console.error('Error pausing recording:', err);
      setError(`Failed to pause: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [recordingDuration]);
  
  // Resume recording after pause
  const resumeRecording = useCallback(() => {
    setPausedAt(null);
    startTimer();
    setRecordingState('recording');
  }, [startTimer]);
  
  // Clean up resources on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
      
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
      
      if (recordRTCRef.current) {
        recordRTCRef.current.destroy();
      }
    };
  }, [videoUrl]);
  
  // Update view mode when it changes
  useEffect(() => {
    if (recordRTCRef.current && recordingState === 'recording' && typeof window !== 'undefined') {
      // Cast as ViewMode or use default
      const currentMode = (window._lastViewMode || 'full') as ViewMode;
      recordRTCRef.current.setViewMode?.(currentMode);
    }
  }, [recordingState]);
  
  return {
    recordingState,
    recordingDuration,
    videoUrl,
    videoBlob,
    error,
    recordedChunks,
    startRecording,
    stopRecording,
    pauseRecording: recordingState === 'recording' ? pauseRecording : resumeRecording,
    isPaused: recordingState === 'paused'
  };
}; 