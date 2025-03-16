import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ViewMode, RecordingState, VideoRecorderProps } from './types';
import { useMediaStreams } from './hooks/useMediaStreams';
import { useRecording } from './hooks/useRecording';
import CanvasRecorder from './components/CanvasRecorder';
import VideoPlayer from './components/VideoPlayer';
import RecordingControls from './components/RecordingControls';
import Teleprompter from './components/Teleprompter';
import DiagnosticPanel from './components/DiagnosticPanel';
import { castRef } from './utils/type-helpers';
import { cleanupAudioResources } from './utils/recorder-factory';
import DiagnosticOverlay from './components/DiagnosticOverlay';
import { audioMonitor } from './utils/audio-monitor';

const VideoRecorder: React.FC<VideoRecorderProps> = ({ script }) => {
  // State
  const [viewMode, setViewMode] = useState<ViewMode>('full');
  const [showTeleprompter, setShowTeleprompter] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastViewChange, setLastViewChange] = useState<string>(new Date().toISOString());
  const [showGreenDownloadButton, setShowGreenDownloadButton] = useState<boolean>(false);
  const [showDebugOverlay, setShowDebugOverlay] = useState<boolean>(false);
  
  // Canvas stream ref
  const canvasStreamRef = useRef<MediaStream | null>(null);
  
  // Initialize media streams with the hook
  const { 
    webcamStream, 
    screenStream, 
    webcamVideoRef,
    circleWebcamRef,
    screenVideoRef,
    initializeWebcam,
    initializeScreenCapture,
    cleanupStreams 
  } = useMediaStreams(viewMode);
  
  // Handle canvas stream ready
  const handleCanvasStreamReady = (stream: MediaStream) => {
    console.log(`Canvas stream ready with ${stream.getTracks().length} tracks`);
    canvasStreamRef.current = stream;
  };
  
  // Initialize recording with the hook
  const {
    recordingState,
    recordingDuration,
    videoUrl,
    videoBlob,
    error: recordingError,
    recordedChunks,
    startRecording,
    stopRecording,
    pauseRecording,
    isPaused
  } = useRecording({
    canvasStream: canvasStreamRef.current,
    webcamStream
  });
  
  // Define the downloadVideo function
  const downloadVideo = useCallback(() => {
    if (!videoBlob) {
      console.error("No video blob available for download");
      return;
    }
    
    // Create a filename with timestamp
    const filename = `recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
    
    // Create a download link
    const a = document.createElement('a');
    const url = videoUrl || URL.createObjectURL(videoBlob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // If we created a new URL, revoke it
    if (!videoUrl) {
      URL.revokeObjectURL(url);
    }
    
    console.log(`Downloading video as ${filename}`);
    
    // Hide green button after download
    setShowGreenDownloadButton(false);
  }, [videoBlob, videoUrl]);
  
  // Combine errors
  useEffect(() => {
    if (recordingError) {
      setError(recordingError);
    }
  }, [recordingError]);
  
  // Ensure view changes propagate to the recorder immediately
  const changeViewMode = async (newMode: ViewMode) => {
    if (newMode === viewMode) return;
    
    console.log(`Changing view from ${viewMode} to ${newMode}`);
    
    // Update state immediately for UI
    setViewMode(newMode);
    setLastViewChange(new Date().toISOString());
    
    // CRITICAL FIX: Explicitly notify the recorder about the view change
    window._lastViewMode = newMode;
    
    // If recording is active, we need to ensure the canvas updates immediately
    if (recordingState === 'recording' || recordingState === 'paused') {
      console.log("Recording active during view change - ensuring recorder updates");
      
      // 1. Force redraw of canvas with new view
      if (canvasStreamRef.current) {
        // Draw the new view immediately
        handleCanvasStreamReady(canvasStreamRef.current);
      }
      
      // 2. Explicitly update the recorder service
      if (canvasStreamRef.current) {
        // This is a placeholder implementation. You might want to implement the logic to update the recorder service
        console.log("Recording active during view change - updating recorder service");
      }
    }
    
    // Store info about current recording state to maintain it
    const isActiveRecording = recordingState === 'recording' || recordingState === 'paused';
    
    if (!isActiveRecording) {
      // Only clean up streams when not recording to prevent audio loss
      cleanupStreams();
    } else {
      console.log("Maintaining streams during view change while recording");
    }
    
    // Initialize streams based on view mode with low memory footprint
    const initStreams = async () => {
      try {
        // For modes requiring screen capture
        if (newMode === 'tutorial' || newMode === 'split') {
          // Only initialize screen if not already active or if changing to this mode
          if (!screenStream || !screenVideoRef.current) {
            await initializeScreenCapture();
          }
        }
        
        // Always ensure webcam is available for all modes
        if (!webcamStream || !webcamVideoRef.current) {
          await initializeWebcam();
        }
        
        console.log("Streams initialized for new view mode:", newMode);
      } catch (err) {
        console.error("Error initializing streams for view change:", err);
        setError(`Failed to change view mode. Please try again. ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    
    // Initialize with slight delay for browser to catch up
    setTimeout(initStreams, 50);
  };
  
  // Call this function when recording completely finishes
  const handleRecordingComplete = useCallback(() => {
    setShowGreenDownloadButton(true);
    
    // Clean up all audio resources to free memory
    if (typeof cleanupAudioResources === 'function') {
      setTimeout(cleanupAudioResources, 1000); // Small delay to ensure processing is done
    }
  }, []);
  
  // Add this useEffect to handle recording state changes
  useEffect(() => {
    if (recordingState === 'idle' && videoUrl) {
      handleRecordingComplete();
    }
  }, [recordingState, videoUrl, handleRecordingComplete]);
  
  // Effect for initializing streams on component mount
  useEffect(() => {
    // Initialize webcam on mount
    initializeWebcam().catch(err => {
      console.error("Failed to initialize webcam on mount:", err);
      setError("Failed to initialize webcam. Please check permissions and try again.");
    });
    
    // Cleanup all streams on unmount
    return () => {
      cleanupStreams();
    };
  }, [initializeWebcam, cleanupStreams]);
  
  // Show download button when recording is complete
  useEffect(() => {
    if (videoBlob && recordingState === 'idle' && recordedChunks.length > 0) {
      setShowGreenDownloadButton(true);
    }
  }, [videoBlob, recordingState, recordedChunks]);
  
  // Toggle teleprompter visibility
  const toggleTeleprompter = useCallback(() => {
    setShowTeleprompter(prev => !prev);
  }, []);
  
  // Add useEffect for monitoring
  useEffect(() => {
    // Start monitoring audio when webcam stream is available
    if (webcamStream && webcamStream.getAudioTracks().length > 0) {
      console.log("Starting audio monitoring from webcam stream");
      audioMonitor.startMonitoring(webcamStream);
    } else if (window._directAudioStream) {
      console.log("Starting audio monitoring from direct audio stream");
      audioMonitor.startMonitoring(window._directAudioStream);
    }
    
    return () => {
      audioMonitor.stopMonitoring();
    };
  }, [webcamStream, window._directAudioStream]);
  
  // Add audio monitoring during recording state changes
  useEffect(() => {
    if (recordingState === 'recording') {
      // Start audio monitoring if not already
      if (window._directAudioStream) {
        audioMonitor.startMonitoring(window._directAudioStream);
      }
    } else if (recordingState === 'idle') {
      // Optional: stop monitoring when not recording
      // audioMonitor.stopMonitoring();
    }
  }, [recordingState]);
  
  return (
    <div className="video-recorder-container max-w-7xl mx-auto p-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="recording-area md:w-2/3">
          <div className="bg-gray-100 rounded-lg p-4 mb-4">
            <div className="flex gap-3 mb-4">
              <button 
                onClick={() => changeViewMode('full')}
                className={`px-3 py-1 rounded-lg ${viewMode === 'full' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              >
                Webcam Only
              </button>
              <button 
                onClick={() => changeViewMode('split')}
                className={`px-3 py-1 rounded-lg ${viewMode === 'split' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              >
                Split View
              </button>
              <button 
                onClick={() => changeViewMode('circle')}
                className={`px-3 py-1 rounded-lg ${viewMode === 'circle' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              >
                Circle Webcam
              </button>
              <button 
                onClick={() => changeViewMode('tutorial')}
                className={`px-3 py-1 rounded-lg ${viewMode === 'tutorial' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              >
                Tutorial
              </button>
            </div>
          
            {error && (
              <div className="p-3 mb-4 bg-red-100 text-red-700 rounded">
                <strong>Error:</strong> {error}
              </div>
            )}
            
            <div className="canvas-container">
              <CanvasRecorder
                isRecording={recordingState === 'recording'}
                viewMode={viewMode}
                webcamVideoRef={webcamVideoRef}
                screenVideoRef={screenVideoRef}
                circleWebcamRef={circleWebcamRef}
                recordingDuration={recordingDuration}
                onCanvasStreamReady={handleCanvasStreamReady}
              />
            </div>
            
            <RecordingControls
              recordingState={recordingState}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onPauseRecording={pauseRecording}
              isPaused={isPaused}
              showTeleprompter={showTeleprompter}
              onToggleTeleprompter={toggleTeleprompter}
              videoUrl={videoUrl}
            />
          </div>
          
          <details className="bg-gray-100 rounded-lg p-4 mb-4">
            <summary className="font-medium mb-2">Diagnostic Information</summary>
            <div className="text-xs font-mono">
              <div>View Mode: {viewMode}</div>
              <div>Recording State: {recordingState}</div>
              <div>Recording Duration: {recordingDuration}s</div>
              <div>Webcam Stream: {webcamStream ? 'Active' : 'Inactive'}</div>
              <div>Screen Stream: {screenStream ? 'Active' : 'Inactive'}</div>
              <div>Canvas Stream: {canvasStreamRef.current ? 'Active' : 'Inactive'}</div>
              <div>Canvas Stream Tracks: {canvasStreamRef.current?.getTracks().length || 0}</div>
              <div>Audio Tracks: {webcamStream?.getAudioTracks().length || 0} (webcam), 
                      {window._audioTracksAdded || 0} (total added)</div>
              <div>Video URL: {videoUrl ? 'Created' : 'None'}</div>
              <div>Video Blob Size: {videoBlob ? `${(videoBlob.size / 1024).toFixed(0)} KB` : 'N/A'}</div>
              <div>Video Blob Type: {videoBlob?.type || 'N/A'}</div>
              <div>Recorded Chunks: {recordedChunks.length}</div>
              <div>Last View Change: {lastViewChange}</div>
              <div>Browser: {navigator.userAgent}</div>
            </div>
          </details>
        </div>
        
        <div className="preview-area md:w-1/3">
          {/* ONLY show green download button when needed */}
          {showGreenDownloadButton && (
            <div className="mt-4 mb-2">
              <button
                onClick={downloadVideo}
                className="bg-green-500 hover:bg-green-600 text-white p-2 px-4 rounded-lg flex items-center justify-center w-full"
              >
                <span>Download Video</span>
              </button>
            </div>
          )}
          
          {/* Only show video player when we have a video */}
          {videoUrl && videoBlob ? (
            <div className="mt-4">
              <VideoPlayer 
                videoUrl={videoUrl} 
                videoBlob={videoBlob} 
                // Always hide download button in VideoPlayer to avoid duplication
                hideDownloadButton={true} 
              />
            </div>
          ) : (
            <DiagnosticPanel />
          )}
        </div>
      </div>
      
      {showTeleprompter && script && (
        <Teleprompter script={Array.isArray(script) ? script.join('\n\n') : script} />
      )}
      
      {/* Add this button to toggle debug mode */}
      <div className="mt-4 text-center">
        <button 
          onClick={() => setShowDebugOverlay(prev => !prev)}
          className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
        >
          {showDebugOverlay ? 'Hide Debugging' : 'Show Debugging'}
        </button>
      </div>
      
      {/* Add the diagnostic overlay */}
      <DiagnosticOverlay
        isVisible={showDebugOverlay}
        viewMode={viewMode}
        recordingState={recordingState}
        audioTrackCount={webcamStream?.getAudioTracks().length || 0}
        canvasAudioTrackCount={canvasStreamRef.current?.getAudioTracks().length || 0}
      />
    </div>
  );
};

export default VideoRecorder; 