import React, { useRef, useEffect, useCallback, useState } from 'react';
import { ViewMode, CanvasRenderingContext2DExtended } from '../types';
import { formatTime } from '../utils/format-utils';

interface CanvasRecorderProps {
  isRecording: boolean;
  viewMode: ViewMode;
  webcamVideoRef: React.RefObject<HTMLVideoElement | null>;
  screenVideoRef: React.RefObject<HTMLVideoElement | null>;
  circleWebcamRef: React.RefObject<HTMLVideoElement | null>;
  recordingDuration?: number;
  onCanvasStreamReady: (stream: MediaStream) => void;
}

const CanvasRecorder: React.FC<CanvasRecorderProps> = ({
  isRecording,
  viewMode,
  webcamVideoRef,
  screenVideoRef,
  circleWebcamRef,
  recordingDuration,
  onCanvasStreamReady
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastViewModeRef = useRef<ViewMode>(viewMode);
  const [transitionMessage, setTransitionMessage] = useState<string | null>(null);
  
  // Initialize canvas stream with memory optimization
  const initializeCanvasStream = useCallback(async () => {
    if (!canvasRef.current) {
      console.error("Canvas ref is not available");
      return;
    }
    
    try {
      // Stop existing stream if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Get the canvas stream
      const stream = canvasRef.current.captureStream(30); // 30 FPS
      
      // CRITICAL FIX: Ensure global audio tracks are properly attached to the canvas stream
      if (window._directAudioStream && window._directAudioStream.getAudioTracks().length > 0) {
        const audioTracks = window._directAudioStream.getAudioTracks();
        
        // Remove existing audio tracks from canvas stream if any
        const existingAudioTracks = stream.getAudioTracks();
        if (existingAudioTracks.length > 0) {
          existingAudioTracks.forEach(track => stream.removeTrack(track));
        }
        
        // Add all audio tracks from the direct audio stream
        audioTracks.forEach(track => {
          console.log(`%c🔊 ADDING AUDIO TRACK: ${track.label}`, "background:green;color:white", {
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState
          });
          stream.addTrack(track);
        });
        
        // Important: Clone the stream to ensure track changes persist
        const finalStream = new MediaStream();
        stream.getTracks().forEach(track => finalStream.addTrack(track));
        streamRef.current = finalStream;
      } else {
        console.warn("No direct audio stream available - canvas will not have audio!");
        streamRef.current = stream;
      }
      
      onCanvasStreamReady(streamRef.current);
    } catch (error) {
      console.error("Failed to initialize canvas stream:", error);
    }
  }, [onCanvasStreamReady]);
  
  // Add memory optimization for canvas context
  const getOptimizedContext = useCallback(() => {
    if (!canvasRef.current) return null;
    
    try {
      // Use lower-memory context settings when possible
      const ctx = canvasRef.current.getContext('2d', {
        alpha: false,  // No alpha channel needed saves memory
        desynchronized: true, // Hint for lower latency
        willReadFrequently: false // We don't read pixel data
      }) as CanvasRenderingContext2DExtended;
      
      return ctx;
    } catch (e) {
      console.warn("Error getting optimized context, falling back:", e);
      return canvasRef.current.getContext('2d') as CanvasRenderingContext2DExtended;
    }
  }, []);
  
  // Draw frames to canvas with improved continuity during view changes
  const drawToCanvas = useCallback(() => {
    // Debugging for canvas drawing and view mode - Fix TS errors with optional chaining
    console.log(`%c🖼️ VIEW DEBUG: Drawing canvas in ${viewMode} mode`, "background:#0ff;color:#000", {
      timestamp: new Date().toISOString(),
      isRecording,
      webcamReady: webcamVideoRef.current?.readyState ? webcamVideoRef.current.readyState >= 2 : false,
      screenReady: screenVideoRef.current?.readyState ? screenVideoRef.current.readyState >= 2 : false,
      canvasWidth: canvasRef.current?.width,
      canvasHeight: canvasRef.current?.height
    });
    
    if (!canvasRef.current) return;
    
    // Get the canvas and context
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2DExtended;
    if (!ctx) return;
    
    // Clear canvas for fresh drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Handle view transition message if active
    if (transitionMessage) {
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = 'white';
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(transitionMessage, canvas.width / 2, canvas.height / 2);
      
      // Also draw small indicator for which view is coming
      ctx.font = '18px Arial';
      ctx.fillText(`Loading ${viewMode} view...`, canvas.width / 2, canvas.height / 2 + 40);
      
      return;
    }
    
    // Standard drawing based on current view mode
    // Drawing logic varies by view mode but ensures continuous recording
    switch (viewMode) {
      case 'full':
        // Full webcam view (most basic)
        if (webcamVideoRef.current) {
          ctx.fillStyle = 'black';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Draw webcam centered and scaled appropriately
          const videoRatio = webcamVideoRef.current.videoWidth / webcamVideoRef.current.videoHeight;
          let drawWidth = canvas.width;
          let drawHeight = canvas.width / videoRatio;
          
          // Adjust if too tall
          if (drawHeight > canvas.height) {
            drawHeight = canvas.height;
            drawWidth = canvas.height * videoRatio;
          }
          
          // Center the video
          const x = (canvas.width - drawWidth) / 2;
          const y = (canvas.height - drawHeight) / 2;
          
          ctx.drawImage(webcamVideoRef.current, x, y, drawWidth, drawHeight);
          
          // Add visual debug indicator to the canvas
          if (isRecording) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
            ctx.fillRect(10, canvas.height - 40, 250, 30);
            ctx.fillStyle = "#000";
            ctx.font = "16px Arial";
            ctx.fillText(`Mode: ${viewMode} - ${new Date().toISOString().slice(11, 19)}`, 15, canvas.height - 20);
          }
        }
        break;
        
      case 'circle':
        // Circle webcam with subtle background
        if (circleWebcamRef.current) {
          // Fill background with dark color
          ctx.fillStyle = '#111';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Create circle mask
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          const radius = Math.min(canvas.width, canvas.height) * 0.4;
          
          ctx.save();
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          
          // Draw webcam inside circle
          if (circleWebcamRef.current.videoWidth) {
            const videoRatio = circleWebcamRef.current.videoWidth / circleWebcamRef.current.videoHeight;
            const drawWidth = radius * 2 * Math.max(1, videoRatio);
            const drawHeight = radius * 2;
            
            ctx.drawImage(
              circleWebcamRef.current,
              centerX - drawWidth / 2,
              centerY - drawHeight / 2,
              drawWidth,
              drawHeight
            );
          }
          
          ctx.restore();
          
          // Add subtle border
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffffff33';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        break;
        
      case 'split':
        // Split screen: screen share on top, webcam on bottom
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        if (screenVideoRef.current && screenVideoRef.current.videoWidth) {
          // Top 70%: screen share
          const screenHeight = canvas.height * 0.7;
          ctx.drawImage(screenVideoRef.current, 0, 0, canvas.width, screenHeight);
          
          // Add subtle divider
          ctx.fillStyle = '#333';
          ctx.fillRect(0, screenHeight - 1, canvas.width, 2);
        }
        
        if (webcamVideoRef.current && webcamVideoRef.current.videoWidth) {
          // Bottom 30%: webcam
          const webcamY = canvas.height * 0.7;
          const webcamHeight = canvas.height * 0.3;
          
          const videoRatio = webcamVideoRef.current.videoWidth / webcamVideoRef.current.videoHeight;
          const drawWidth = webcamHeight * videoRatio;
          
          // Center horizontally
          const x = (canvas.width - drawWidth) / 2;
          
          ctx.drawImage(webcamVideoRef.current, x, webcamY, drawWidth, webcamHeight);
        }
        break;
        
      case 'tutorial':
        // Tutorial mode: screen share with small webcam overlay
        if (screenVideoRef.current) {
          // Draw screen share as background
          ctx.fillStyle = 'black';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(screenVideoRef.current, 0, 0, canvas.width, canvas.height);
          
          // Draw webcam overlay in bottom right
          if (webcamVideoRef.current && webcamVideoRef.current.videoWidth) {
            const overlayWidth = canvas.width * 0.25;
            const videoRatio = webcamVideoRef.current.videoWidth / webcamVideoRef.current.videoHeight;
            const overlayHeight = overlayWidth / videoRatio;
            
            const x = canvas.width - overlayWidth - 20;
            const y = canvas.height - overlayHeight - 20;
            
            // Draw background for webcam
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.beginPath();
            ctx.arc(x + overlayWidth / 2, y + overlayHeight / 2, 
                   Math.max(overlayWidth, overlayHeight) / 1.8, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw webcam in circular mask
            ctx.save();
            ctx.beginPath();
            ctx.arc(x + overlayWidth / 2, y + overlayHeight / 2, 
                   Math.min(overlayWidth, overlayHeight) / 2.2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(webcamVideoRef.current, x, y, overlayWidth, overlayHeight);
            ctx.restore();
            
            // Add subtle border
            ctx.beginPath();
            ctx.arc(x + overlayWidth / 2, y + overlayHeight / 2, 
                   Math.min(overlayWidth, overlayHeight) / 2.2, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
        break;
    }
    
    // Draw recording time if recording
    if (isRecording && typeof recordingDuration === 'number') {
      const timeText = formatTime(recordingDuration);
      
      // Draw background pill
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      const textWidth = timeText.length * 14;
      const pillWidth = textWidth + 20;
      const pillHeight = 30;
      const pillX = 10;
      const pillY = 10;
      
      ctx.beginPath();
      ctx.arc(pillX + pillHeight/2, pillY + pillHeight/2, pillHeight/2, Math.PI/2, Math.PI*3/2);
      ctx.arc(pillX + pillWidth - pillHeight/2, pillY + pillHeight/2, pillHeight/2, Math.PI*3/2, Math.PI/2);
      ctx.closePath();
      ctx.fill();
      
      // Draw record indicator dot
      ctx.beginPath();
      ctx.arc(pillX + 15, pillY + pillHeight/2, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.fill();
      
      // Draw time text
      ctx.fillStyle = 'white';
      ctx.font = '16px Arial';
      ctx.textBaseline = 'middle';
      ctx.fillText(timeText, pillX + 30, pillY + pillHeight/2);
      
      // CRITICAL ADDITION: Audio status indicator
      // Check if there's an active audio track by looking at the global audio stream
      const hasAudio = window._directAudioStream?.active && 
                       (window._directAudioStream?.getAudioTracks().length > 0) &&
                       window._directAudioStream?.getAudioTracks()[0].enabled;
      
      // Draw audio status pill
      const audioText = hasAudio ? "🎤 Audio ON" : "🔇 NO AUDIO";
      const audioColor = hasAudio ? "rgba(0, 255, 0, 0.5)" : "rgba(255, 0, 0, 0.5)";
      const audioTextWidth = audioText.length * 10;
      const audioPillWidth = audioTextWidth + 20;
      const audioPillHeight = 30;
      const audioPillX = 10;
      const audioPillY = pillY + pillHeight + 10;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.arc(audioPillX + audioPillHeight/2, audioPillY + audioPillHeight/2, audioPillHeight/2, Math.PI/2, Math.PI*3/2);
      ctx.arc(audioPillX + audioPillWidth - audioPillHeight/2, audioPillY + audioPillHeight/2, audioPillHeight/2, Math.PI*3/2, Math.PI/2);
      ctx.closePath();
      ctx.fill();
      
      // Draw indicator circle
      ctx.beginPath();
      ctx.arc(audioPillX + 15, audioPillY + audioPillHeight/2, 6, 0, Math.PI * 2);
      ctx.fillStyle = audioColor;
      ctx.fill();
      
      // Draw audio text
      ctx.fillStyle = 'white';
      ctx.font = '14px Arial';
      ctx.fillText(audioText, audioPillX + 30, audioPillY + audioPillHeight/2);
      
      // CRITICAL ADDITION: View mode indicator
      // Draw view mode status
      const viewText = `View: ${viewMode}`;
      const viewPillWidth = viewText.length * 10 + 20;
      const viewPillHeight = 30;
      const viewPillX = 10;
      const viewPillY = audioPillY + audioPillHeight + 10;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.arc(viewPillX + viewPillHeight/2, viewPillY + viewPillHeight/2, viewPillHeight/2, Math.PI/2, Math.PI*3/2);
      ctx.arc(viewPillX + viewPillWidth - viewPillHeight/2, viewPillY + viewPillHeight/2, viewPillHeight/2, Math.PI*3/2, Math.PI/2);
      ctx.closePath();
      ctx.fill();
      
      // Draw view mode text
      ctx.fillStyle = 'white';
      ctx.font = '14px Arial';
      ctx.fillText(viewText, viewPillX + 15, viewPillY + viewPillHeight/2);
    }
    
    // Continue animation loop
    animFrameRef.current = requestAnimationFrame(drawToCanvas);
  }, [viewMode, isRecording, recordingDuration, webcamVideoRef, screenVideoRef, circleWebcamRef, transitionMessage]);
  
  // Set up animation loop when component mounts
  useEffect(() => {
    drawToCanvas();
    initializeCanvasStream();
    
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
        });
      }
    };
  }, [drawToCanvas, initializeCanvasStream]);
  
  // Handle view mode changes with a transition indicator
  useEffect(() => {
    console.log(`%c🖼️ VIEW DEBUG: View mode changed to ${viewMode}`, 
      "background:#0ff;color:#000", {
      timestamp: new Date().toISOString(),
      previousMode: lastViewModeRef.current,
      isRecording,
      canvasActive: !!canvasRef.current
    });
    
    if (viewMode !== lastViewModeRef.current) {
      // Update global reference immediately
      window._lastViewMode = viewMode;
      
      // Show transition message
      setTransitionMessage(`Changing view...`);
      
      // Update the reference to avoid re-triggering
      lastViewModeRef.current = viewMode;
      
      // CRITICAL FIX: Dispatch event for RecordRTC to know about view change
      const viewChangeEvent = new CustomEvent('recorder:viewModeChanged', { 
        detail: { viewMode } 
      });
      window.dispatchEvent(viewChangeEvent);
      
      // Force canvas redraw with the new view mode
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      
      // Short delay to ensure everything is ready
      setTimeout(() => {
        // Clear transition message
        setTransitionMessage(null);
        
        // Start a new animation frame with current view mode
        animFrameRef.current = requestAnimationFrame(drawToCanvas);
        
        // Only reinitialize canvas stream if not recording
        if (!isRecording) {
          initializeCanvasStream();
        }
      }, 300);
    }
  }, [viewMode, drawToCanvas, initializeCanvasStream, isRecording]);
  
  return (
    <div className="canvas-container">
      <canvas 
        ref={canvasRef}
        className="recording-canvas"
        style={{ 
          display: 'block',
          width: '100%', 
          maxWidth: '1280px',
          height: 'auto',
          margin: '0 auto',
          backgroundColor: '#000'
        }}
        width={1280}
        height={720}
      />
    </div>
  );
};

export default CanvasRecorder; 