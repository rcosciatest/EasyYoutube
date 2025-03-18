// Fixed useMediaStreams hook with more reliable stream initialization
import { useState, useRef, useEffect } from 'react';
import { ViewMode } from '../types';

interface UseMediaStreamsResult {
  webcamStream: MediaStream | null;
  screenStream: MediaStream | null;
  webcamVideoRef: React.RefObject<HTMLVideoElement | null>;
  circleWebcamRef: React.RefObject<HTMLVideoElement | null>;
  screenVideoRef: React.RefObject<HTMLVideoElement | null>;
  initializeWebcam: () => Promise<MediaStream | null>;
  initializeScreenCapture: () => Promise<MediaStream | null>;
  cleanupStreams: () => void;
}

export const useMediaStreams = (initialViewMode: ViewMode): UseMediaStreamsResult => {
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  
  // Video element refs
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const circleWebcamRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  // Initialize webcam with better error handling and retries
  const initializeWebcam = async (): Promise<MediaStream | null> => {
    if (isInitializing) {
      console.log("Webcam initialization already in progress");
      return webcamStream;
    }
    
    try {
      setIsInitializing(true);
      console.log("Initializing webcam with audio...");
      
      // Release existing stream if needed
      if (webcamStream && webcamStream.active) {
        webcamStream.getTracks().forEach(track => track.stop());
      }
      
      // First check if permissions are already granted
      const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
      
      if (permissionStatus.state === 'denied') {
        console.error("Camera permission denied by browser");
        throw new Error("Camera permission denied. Please allow camera access in your browser settings.");
      }
      
      // Request with both audio and video with more detailed constraints
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      });
      
      console.log(`Webcam initialized with ${stream.getTracks().length} tracks:`);
      stream.getTracks().forEach(track => {
        console.log(`- ${track.kind}: ${track.label} (${track.enabled ? 'enabled' : 'disabled'})`);
      });
      
      // Verify we have both video and audio tracks
      if (stream.getVideoTracks().length === 0) {
        throw new Error("No video tracks available from camera");
      }
      
      // Even if no audio tracks, continue with video - we'll handle audio separately
      setWebcamStream(stream);
      
      // Store it globally for easy access
      window._webcamStream = stream;
      
      // Immediately attach to video elements
      const attachToVideoElements = () => {
        if (webcamVideoRef.current) {
          webcamVideoRef.current.srcObject = stream;
          webcamVideoRef.current.muted = true; // Prevent feedback
          webcamVideoRef.current.play().catch(e => console.warn("Could not autoplay webcam:", e));
        }
        
        if (circleWebcamRef.current) {
          circleWebcamRef.current.srcObject = stream;
          circleWebcamRef.current.muted = true;
          circleWebcamRef.current.play().catch(e => console.warn("Could not autoplay circle webcam:", e));
        }
      };
      
      // Try to connect immediately
      attachToVideoElements();
      
      // Also try after a short delay to ensure elements are ready
      setTimeout(attachToVideoElements, 100);
      
      return stream;
    } catch (err) {
      console.error("Failed to initialize webcam:", err);
      // Show user-friendly error message
      const errorMessage = err instanceof Error ? err.message : String(err);
      const userError = errorMessage.includes("Permission denied") || 
                        errorMessage.includes("Permission dismissed") ||
                        errorMessage.includes("NotAllowedError") ?
        "Could not access camera and microphone. Please ensure you have given permission." :
        `Failed to initialize webcam: ${errorMessage}`;
        
      // Add a button to retry
      const errorDiv = document.createElement('div');
      errorDiv.className = 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative';
      errorDiv.innerHTML = `
        <p>${userError}</p>
        <button class="mt-2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded">
          Retry Camera Access
        </button>
        <button class="mt-2 ml-2 text-red-700 font-bold py-1 px-2 rounded dismiss-btn">
          Dismiss
        </button>
      `;
      
      // Add to the top of the video recorder container
      const container = document.querySelector('.video-recorder-container');
      if (container && !document.querySelector('.bg-red-100')) {
        container.prepend(errorDiv);
        
        // Add retry handler
        const retryBtn = errorDiv.querySelector('button');
        if (retryBtn) {
          retryBtn.addEventListener('click', async () => {
            errorDiv.remove();
            await initializeWebcam();
          });
        }
        
        // Add dismiss handler
        const dismissBtn = errorDiv.querySelector('.dismiss-btn');
        if (dismissBtn) {
          dismissBtn.addEventListener('click', () => {
            errorDiv.remove();
          });
        }
      }
      
      return null;
    } finally {
      setIsInitializing(false);
    }
  };

  // Initialize screen capture with better error handling
  const initializeScreenCapture = async (): Promise<MediaStream | null> => {
    if (isInitializing) {
      console.log("Screen capture initialization already in progress");
      return screenStream;
    }
    
    try {
      setIsInitializing(true);
      console.log("Initializing screen capture...");
      
      // Release existing stream if needed
      if (screenStream && screenStream.active) {
        screenStream.getTracks().forEach(track => track.stop());
      }
      
      // Request screen capture
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false  // Usually screen capture audio causes echo
      });
      
      console.log(`Screen capture initialized with ${stream.getTracks().length} tracks`);
      
      setScreenStream(stream);
      
      // Immediately attach to video element
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        screenVideoRef.current.muted = true;
        screenVideoRef.current.play().catch(e => console.warn("Could not autoplay screen:", e));
      }
      
      // Also attempt after a delay
      setTimeout(() => {
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream;
          screenVideoRef.current.play().catch(e => console.warn("Could not autoplay screen (retry):", e));
        }
      }, 100);
      
      return stream;
    } catch (err) {
      console.error("Failed to initialize screen capture:", err);
      return null;
    } finally {
      setIsInitializing(false);
    }
  };

  // Cleanup all streams
  const cleanupStreams = () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
      setWebcamStream(null);
    }
    
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
    }
  };

  // Auto-initialize webcam on mount
  useEffect(() => {
    initializeWebcam();
    
    // Auto-initialize screen capture if in split mode
    if (initialViewMode === 'split') {
      initializeScreenCapture();
    }
    
    return cleanupStreams;
  }, []);

  return {
    webcamStream,
    screenStream,
    webcamVideoRef,
    circleWebcamRef,
    screenVideoRef,
    initializeWebcam,
    initializeScreenCapture,
    cleanupStreams
  };
}; 