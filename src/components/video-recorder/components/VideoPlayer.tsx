import React, { useState, useEffect, useRef } from 'react';
import { VideoPlayerProps } from '../types';
import { configureVideoElement } from '../utils/video-processor';
import VideoAudioDebugger from './VideoAudioDebugger';

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUrl, videoBlob, hideDownloadButton = false }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasAudioTracks, setHasAudioTracks] = useState(false);
  
  // Reset loading state when URL changes
  useEffect(() => {
    if (videoUrl) {
      setIsLoading(true);
      setError(null);
      
      // Ensure video element is properly configured for playback
      if (videoRef.current && videoUrl) {
        configureVideoElement(videoRef.current, videoUrl);
        
        // Set volume programmatically instead of as an attribute
        videoRef.current.volume = 1.0;
      }
    }
  }, [videoUrl]);
  
  // CRITICAL AUDIO FIX: Ensure audio is properly initialized on video element
  useEffect(() => {
    if (videoRef.current && videoUrl) {
      try {
        // First, set direct properties on video element
        videoRef.current.muted = false;
        videoRef.current.volume = 1.0;
        
        // Use our utility to properly configure the video
        configureVideoElement(videoRef.current, videoUrl);
        
        // CRITICAL FIX: Force user interaction to enable audio
        // This helps with browsers that require user gesture for audio
        const unlockAudio = () => {
          if (videoRef.current) {
            videoRef.current.muted = false;
            videoRef.current.play().catch(e => console.log('Audio unlock play failed, not critical:', e));
            videoRef.current.pause();
            document.body.removeEventListener('click', unlockAudio);
            document.body.removeEventListener('touchstart', unlockAudio);
          }
        };
        
        document.body.addEventListener('click', unlockAudio, { once: true });
        document.body.addEventListener('touchstart', unlockAudio, { once: true });
        
        console.log('✅ Enhanced audio settings applied to video player');
      } catch (err) {
        console.error('Failed to apply audio fixes to video player:', err);
      }
    }
  }, [videoUrl]);
  
  const handleCanPlay = () => {
    console.log("Video can play, ending loading state");
    setIsLoading(false);
  };
  
  const handleError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error("Video playback error:", e);
    setIsLoading(false);
    setError("Unable to play this video in browser");
    
    // Get more detailed error information
    const videoElement = e.target as HTMLVideoElement;
    if (videoElement.error) {
      setErrorDetails(`Error code: ${videoElement.error.code}, message: ${videoElement.error.message || 'Unknown'}`);
    }
  };
  
  useEffect(() => {
    if (videoRef.current && videoUrl) {
      // Force audio configuration
      videoRef.current.muted = false;
      videoRef.current.volume = 1.0;
      
      // Add this to fix audio in Safari
      document.addEventListener('click', () => {
        if (videoRef.current) {
          videoRef.current.play().catch(e => console.log('Play attempt:', e));
        }
      }, { once: true });
    }
  }, [videoUrl]);
  
  // Effect to check if video has audio tracks when videoUrl changes
  useEffect(() => {
    if (!videoUrl || !videoRef.current) return;
    
    // Reset video element
    videoRef.current.pause();
    videoRef.current.currentTime = 0;
    videoRef.current.load();
    
    // Check for audio tracks after metadata is loaded
    const handleMetadata = () => {
      const video = videoRef.current;
      if (!video) return;
      
      // Safely detect audio tracks (check for different browser implementations)
      const hasAudio = (() => {
        // Try standard audioTracks property
        if (video.audioTracks && video.audioTracks.length > 0) {
          return true;
        }
        
        // Fallback detection method - if muted is false and volume > 0, likely has audio
        // This is not 100% reliable but a reasonable fallback
        if (video.volume > 0 && !video.muted) {
          // Create an AudioContext to analyze if possible
          try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = audioCtx.createMediaElementSource(video);
            const analyser = audioCtx.createAnalyser();
            source.connect(analyser);
            analyser.connect(audioCtx.destination);
            
            // Check if audio data exists
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            const sum = dataArray.reduce((a, b) => a + b, 0);
            
            return sum > 0;
          } catch (e) {
            console.log("Audio analysis failed, assuming audio exists:", e);
            return true; // Assume audio exists if we can't analyze
          }
        }
        
        return false;
      })();
      
      // Log detailed media information safely
      console.log("🔊 Video metadata loaded:", {
        duration: video.duration.toFixed(2) + "s",
        audioTracks: (video.audioTracks?.length ?? "N/A"),
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        hasAudioDetected: hasAudio
      });
      
      // Update state with audio info
      setHasAudioTracks(hasAudio);
      
      // Ensure volume is at maximum
      video.volume = 1.0;
      video.muted = false;
    };
    
    videoRef.current.addEventListener('loadedmetadata', handleMetadata);
    
    return () => {
      videoRef.current?.removeEventListener('loadedmetadata', handleMetadata);
    };
  }, [videoUrl]);
  
  // Handle download with proper MIME type for audio
  const handleDownload = () => {
    if (!videoUrl || !videoBlob) return;
    
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `recording-${new Date().toISOString()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  
  return (
    <div className="bg-gray-100 rounded-lg p-4">
      <h3 className="text-lg font-medium mb-2">Recording Preview</h3>
      
      {isLoading && (
        <div className="py-4 text-center bg-gray-100 rounded-lg mb-2">
          <span className="inline-block">Loading video preview...</span>
        </div>
      )}
      
      <div className="bg-black rounded-lg overflow-hidden">
        <video 
          ref={videoRef}
          className="w-full h-auto"
          controls
          playsInline
          src={videoUrl || undefined}
          onCanPlay={handleCanPlay}
          onError={handleError}
          // Add preload attribute for better loading behavior
          preload="auto"
          // Ensure audio is not muted
          muted={false}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          style={{ width: '100%', maxHeight: '70vh' }}
        />
      </div>
      
      {error && (
        <div className="mt-2 p-3 bg-red-100 text-red-700 rounded">
          <p><strong>{error}</strong></p>
          <p className="text-sm mt-1">Please download the video to view properly.</p>
          {errorDetails && (
            <p className="text-xs mt-1 text-gray-700">Technical details: {errorDetails}</p>
          )}
        </div>
      )}
      
      {!hideDownloadButton && videoUrl && (
        <button 
          onClick={handleDownload}
          className="download-button"
        >
          Download Recording
        </button>
      )}
      
      {!hasAudioTracks && videoUrl && (
        <div className="audio-warning">
          ⚠️ Warning: No audio tracks detected in recording
        </div>
      )}
      
      <VideoAudioDebugger videoUrl={videoUrl} videoBlob={videoBlob} />
    </div>
  );
};

export default VideoPlayer; 