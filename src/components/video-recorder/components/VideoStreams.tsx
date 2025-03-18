import React, { useRef, useEffect } from 'react';
import { ViewMode } from '../types';
import { connectStreamToVideo } from '../utils/video-connector';

interface VideoStreamsProps {
  webcamStream: MediaStream | null;
  screenStream: MediaStream | null;
  viewMode: ViewMode;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  circleWebcamRef?: React.RefObject<HTMLVideoElement | null>;
  screenVideoRef?: React.RefObject<HTMLVideoElement | null>;
}

const VideoStreams: React.FC<VideoStreamsProps> = ({ 
  webcamStream, 
  screenStream, 
  viewMode,
  videoRef: externalWebcamRef,
  circleWebcamRef: externalCircleRef,
  screenVideoRef: externalScreenRef
}) => {
  // Refs for video elements
  const internalWebcamRef = useRef<HTMLVideoElement>(null);
  const internalScreenRef = useRef<HTMLVideoElement>(null);
  const internalCircleRef = useRef<HTMLVideoElement>(null);
  
  // Use external refs if provided, otherwise fall back to internal refs
  const webcamRef = externalWebcamRef || internalWebcamRef;
  const screenRef = externalScreenRef || internalScreenRef;
  const circleWebcamRef = externalCircleRef || internalCircleRef;
  
  // Track connection status to avoid duplicate connections
  const webcamConnected = useRef<boolean>(false);
  const screenConnected = useRef<boolean>(false);
  
  // Connect webcam stream when available
  useEffect(() => {
    if (webcamStream && webcamRef.current && !webcamConnected.current) {
      console.log(`VideoStreams: Connecting webcam stream (${viewMode} mode)`);
      
      connectStreamToVideo(webcamRef.current, webcamStream, "Webcam")
        .then(success => {
          if (success) {
            webcamConnected.current = true;
          }
        });
    }
    
    // Also connect to circle webcam if in split mode
    if (webcamStream && circleWebcamRef.current && viewMode === 'split' && !webcamConnected.current) {
      connectStreamToVideo(circleWebcamRef.current, webcamStream, "Circle webcam");
    }
  }, [webcamStream, viewMode, webcamRef, circleWebcamRef]);
  
  // Connect screen stream when available
  useEffect(() => {
    // Only attempt to connect if we have both the reference and stream
    if (screenStream && screenRef.current && !screenConnected.current) {
      console.log(`VideoStreams: Connecting screen stream (${viewMode} mode)`);
      
      connectStreamToVideo(screenRef.current, screenStream, "Screen capture")
        .then(success => {
          if (success) {
            screenConnected.current = true;
          }
        });
    }
  }, [screenStream, viewMode, screenRef]);
  
  // Reset connection flags when streams change
  useEffect(() => {
    webcamConnected.current = false;
    screenConnected.current = false;
  }, [webcamStream, screenStream]);
  
  // Add cleanup when component unmounts
  useEffect(() => {
    return () => {
      console.log("VideoStreams component unmounting, resetting connection flags");
      webcamConnected.current = false;
      screenConnected.current = false;
    };
  }, []);
  
  return (
    <div className="video-display relative">
      {/* Main view container */}
      <div className="main-view relative">
        {/* Webcam view - shown in full or split mode */}
        {(viewMode === 'full' || viewMode === 'circle' || viewMode === 'split') && (
          <div className={`webcam-container ${viewMode === 'split' ? 'w-1/3 absolute bottom-0 right-0 z-10' : 'w-full'}`}>
            <video 
              ref={internalWebcamRef}
              className={`webcam-video ${viewMode === 'split' ? 'hidden' : 'w-full h-full object-cover'}`}
              autoPlay 
              playsInline
              muted
            />
          </div>
        )}
        
        {/* Screen view - shown in tutorial or split mode */}
        {(viewMode === 'tutorial' || viewMode === 'split') && (
          <div className={`screen-container ${viewMode === 'split' ? 'w-full' : 'w-full'}`}>
            <video 
              ref={internalScreenRef}
              className="screen-video w-full h-full object-contain"
              autoPlay 
              playsInline
              muted
            />
          </div>
        )}
        
        {/* Circle webcam overlay for split mode */}
        {viewMode === 'split' && (
          <div className="circle-webcam-container absolute bottom-4 right-4 w-1/4 h-1/4 rounded-full overflow-hidden border-2 border-white z-20">
            <video 
              ref={internalCircleRef}
              className="circle-webcam-video w-full h-full object-cover"
              autoPlay 
              playsInline
              muted
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoStreams; 