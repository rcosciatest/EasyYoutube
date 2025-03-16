import React, { useRef, useEffect, useCallback } from 'react';
import { ViewMode, CanvasRenderingContext2DExtended } from './types';
import { formatTime } from './utils/media-utils';

interface CanvasRecorderProps {
  webcamVideoRef: React.RefObject<HTMLVideoElement | null>;
  circleWebcamRef: React.RefObject<HTMLVideoElement | null>;
  screenVideoRef: React.RefObject<HTMLVideoElement | null>;
  viewMode: ViewMode;
  isRecording: boolean;
  recordingDuration: number;
  onCanvasStreamReady: (stream: MediaStream) => void;
}

const CanvasRecorder: React.FC<CanvasRecorderProps> = ({
  webcamVideoRef,
  circleWebcamRef,
  screenVideoRef,
  viewMode,
  isRecording,
  recordingDuration,
  onCanvasStreamReady
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Create a memoized draw function that captures the latest props
  const drawToCanvas = useCallback(() => {
    // Create canvas only once if it doesn't exist
    if (!canvasRef.current) {
      console.log("Creating new canvas for recording");
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 1280;  // HD resolution
      canvasRef.current.height = 720;
    }
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2DExtended;
    
    if (!ctx) {
      console.error("Could not get canvas context");
      return;
    }
    
    // Clear canvas completely first
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    try {
      // Log the current view mode for debugging
      console.log(`Drawing canvas in ${viewMode} mode`);
      
      if (viewMode === 'full') {
        // Draw the webcam video full screen
        if (webcamVideoRef.current && webcamVideoRef.current.readyState >= 2) {
          ctx.drawImage(webcamVideoRef.current, 0, 0, canvas.width, canvas.height);
        } else {
          console.warn("Webcam video not ready for full view");
        }
      } else if (viewMode === 'split') {
        // Draw screen capture background
        if (screenVideoRef.current && screenVideoRef.current.readyState >= 2) {
          ctx.drawImage(screenVideoRef.current, 0, 0, canvas.width, canvas.height);
        } else {
          console.warn("Screen video not ready for split view");
          // Fill with black if screen not available
          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        // Draw webcam overlay
        if (circleWebcamRef.current && circleWebcamRef.current.readyState >= 2) {
          const size = Math.min(canvas.width, canvas.height) * 0.25;
          const x = canvas.width - size - 20;
          const y = canvas.height - size - 20;
          
          // Draw webcam with rounded corners
          ctx.save();
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, y, size, size, 8);
          } else {
            ctx.rect(x, y, size, size);
          }
          ctx.clip();
          ctx.drawImage(circleWebcamRef.current, x, y, size, size);
          ctx.restore();
          
          // Add border
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 3;
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, y, size, size, 8);
          } else {
            ctx.rect(x, y, size, size);
          }
          ctx.stroke();
        } else {
          console.warn("Circle webcam not ready for split view");
        }
      }
      
      // Add recording indicator and time
      if (isRecording) {
        // Red recording dot
        ctx.fillStyle = "#ff0000";
        ctx.beginPath();
        ctx.arc(20, 20, 8, 0, 2 * Math.PI);
        ctx.fill();
        
        // Recording time
        ctx.fillStyle = "#ffffff";
        ctx.font = "16px Arial";
        ctx.fillText(formatTime(recordingDuration), 40, 25);
        
        // View mode indicator (for debugging)
        ctx.fillStyle = "#ffffff";
        ctx.font = "12px Arial";
        ctx.fillText(`Mode: ${viewMode}`, canvas.width - 100, 20);
      }
    } catch (err) {
      console.error("Error drawing to canvas:", err);
    }
    
    // Request next frame
    animFrameRef.current = requestAnimationFrame(drawToCanvas);
  }, [webcamVideoRef, circleWebcamRef, screenVideoRef, viewMode, isRecording, recordingDuration]);

  // Set up and clean up the canvas stream
  useEffect(() => {
    console.log("Setting up canvas recorder with view mode:", viewMode);
    
    // Create canvas if it doesn't exist
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 1280;
      canvasRef.current.height = 720;
    }
    
    // Start drawing loop
    drawToCanvas();
    
    // Create stream with consistent framerate if it doesn't exist
    if (!streamRef.current) {
      streamRef.current = canvasRef.current.captureStream(30);
      console.log(`Created new canvas stream with ${streamRef.current.getTracks().length} tracks`);
      onCanvasStreamReady(streamRef.current);
    }
    
    // Cleanup function
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [drawToCanvas, onCanvasStreamReady]);

  // Listen for view mode changes and force redraw
  useEffect(() => {
    console.log(`CanvasRecorder: View mode changed to ${viewMode}`);
    
    // Cancel any existing animation
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    
    // Force an immediate redraw with the new view mode
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d', { alpha: false });
      if (ctx) {
        // Clear canvas first
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw current frame based on view mode
        if (viewMode === 'full' && webcamVideoRef.current) {
          if (webcamVideoRef.current.readyState >= 2) {
            ctx.drawImage(webcamVideoRef.current, 0, 0, canvas.width, canvas.height);
          }
        } else if (viewMode === 'split') {
          // Draw screen capture as background
          if (screenVideoRef.current && screenVideoRef.current.readyState >= 2) {
            ctx.drawImage(screenVideoRef.current, 0, 0, canvas.width, canvas.height);
            
            // Draw webcam in corner
            if (circleWebcamRef.current && circleWebcamRef.current.readyState >= 2) {
              const size = Math.min(canvas.width, canvas.height) * 0.25;
              const x = canvas.width - size - 20;
              const y = canvas.height - size - 20;
              
              // Draw with rounded rectangle if supported
              ctx.save();
              ctx.beginPath();
              if (typeof (ctx as any).roundRect === 'function') {
                (ctx as any).roundRect(x, y, size, size, 8);
              } else {
                ctx.rect(x, y, size, size);
              }
              ctx.clip();
              ctx.drawImage(circleWebcamRef.current, x, y, size, size);
              ctx.restore();
              
              // Add border
              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth = 3;
              ctx.beginPath();
              if (typeof (ctx as any).roundRect === 'function') {
                (ctx as any).roundRect(x, y, size, size, 8);
              } else {
                ctx.rect(x, y, size, size);
              }
              ctx.stroke();
            }
          }
        }
      }
    }
    
    // Restart animation loop
    if (isRecording) {
      animFrameRef.current = requestAnimationFrame(drawToCanvas);
    }
  }, [viewMode, drawToCanvas, isRecording]);
  
  return null; // This is a non-visual component
};

export default CanvasRecorder; 