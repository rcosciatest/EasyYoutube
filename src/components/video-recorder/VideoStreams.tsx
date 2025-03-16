import React, { useRef, useEffect, useState } from 'react';
import { ViewMode } from './types';

interface VideoStreamsProps {
  viewMode: ViewMode;
  onCameraStreamReady: (stream: MediaStream) => void;
  onScreenStreamReady: (stream: MediaStream) => void;
  onError: (message: string) => void;
}

const VideoStreams: React.FC<VideoStreamsProps> = ({
  viewMode,
  onCameraStreamReady,
  onScreenStreamReady,
  onError
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const circleWebcamRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const [isCameraInitialized, setIsCameraInitialized] = useState(false);
  const [isScreenInitialized, setIsScreenInitialized] = useState(false);
  
  // Safely connect a stream to a video element
  const connectStreamToVideo = async (
    videoElement: HTMLVideoElement | null, 
    stream: MediaStream,
    elementName: string
  ): Promise<boolean> => {
    if (!videoElement) return false;
    
    try {
      // First check if already connected to prevent unnecessary operations
      if (videoElement.srcObject === stream && 
          !videoElement.paused && 
          videoElement.readyState >= 2) {
        console.log(`${elementName} already properly connected and playing`);
        return true;
      }
      
      // Clear existing content
      videoElement.pause();
      videoElement.srcObject = null;
      
      // Set new stream
      videoElement.srcObject = stream;
      
      // Use load() to reset state before playing
      videoElement.load();
      
      // Add event listeners for more detailed debugging
      const playPromise = videoElement.play();
      
      await playPromise;
      console.log(`${elementName} connected and playing successfully`);
      return true;
    } catch (err) {
      console.error(`Error connecting stream to ${elementName}:`, err);
      // Don't throw, just return false to indicate failure
      return false;
    }
  };
  
  // Initialize camera with retry mechanism
  useEffect(() => {
    // Skip if already initialized to prevent multiple initialization attempts
    if (isCameraInitialized) return;
    
    let retryCount = 0;
    const maxRetries = 3;
    let cameraStream: MediaStream | null = null;
    
    const initWebcam = async () => {
      try {
        console.log("Initializing webcam...");
        
        // Request camera and microphone access
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        cameraStream = stream;
        
        // Connect stream to video elements with delay between operations
        const mainConnected = await connectStreamToVideo(
          videoRef.current, 
          stream, 
          "Main webcam"
        );
        
        // Wait a bit before connecting to second element to prevent race conditions
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const circleConnected = await connectStreamToVideo(
          circleWebcamRef.current, 
          stream, 
          "Circle webcam"
        );
        
        if (mainConnected || circleConnected) {
          // Notify parent even if only one connection succeeded
          onCameraStreamReady(stream);
          setIsCameraInitialized(true);
          console.log("Camera initialization complete");
        } else {
          throw new Error("Failed to connect camera stream to video elements");
        }
      } catch (err) {
        console.error(`Webcam initialization attempt ${retryCount + 1} failed:`, err);
        
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying webcam initialization (${retryCount}/${maxRetries})...`);
          setTimeout(initWebcam, 1000); // Wait 1 second before retry
        } else {
          onError(`Camera access failed after ${maxRetries} attempts: ${err}`);
        }
      }
    };
    
    initWebcam();
    
    // Cleanup
    return () => {
      if (cameraStream) {
        console.log("Cleaning up camera stream");
        cameraStream.getTracks().forEach(track => {
          track.stop();
        });
      }
    };
  }, [onCameraStreamReady, onError, isCameraInitialized]);
  
  // Handle screen capture
  useEffect(() => {
    // Only initialize screen capture in split mode and if not already initialized
    if (viewMode !== 'split' || isScreenInitialized) return;
    
    const startScreenShare = async () => {
      try {
        console.log("Starting screen capture...");
        
        const stream = await navigator.mediaDevices.getDisplayMedia({ 
          video: { displaySurface: 'monitor' } as any
        });
        
        // Connect stream to video element
        const connected = await connectStreamToVideo(
          screenVideoRef.current, 
          stream, 
          "Screen video"
        );
        
        if (connected) {
          onScreenStreamReady(stream);
          setIsScreenInitialized(true);
          console.log("Screen capture initialized");
          
          // Add track ended listener to handle when user ends screen sharing
          stream.getVideoTracks()[0].onended = () => {
            console.log("Screen sharing ended by user");
            setIsScreenInitialized(false);
          };
        }
      } catch (err) {
        console.error('Error starting screen capture:', err);
        onError(`Screen capture failed: ${err}`);
      }
    };
    
    startScreenShare();
  }, [viewMode, onScreenStreamReady, onError, isScreenInitialized]);
  
  // Reset screen initialization when changing to full view
  useEffect(() => {
    if (viewMode === 'full' && isScreenInitialized) {
      setIsScreenInitialized(false);
    }
  }, [viewMode, isScreenInitialized]);
  
  return (
    <>
      {/* Invisible video elements for stream handling */}
      <div className="hidden">
        <video ref={videoRef} playsInline muted />
        <video ref={circleWebcamRef} playsInline muted />
        <video ref={screenVideoRef} playsInline muted />
      </div>
      
      {/* Return references as a prop getter function */}
      {(props: any) => ({
        ...props,
        videoRef,
        circleWebcamRef,
        screenVideoRef
      })}
    </>
  );
};

export default VideoStreams; 