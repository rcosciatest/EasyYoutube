import React, { useState, useEffect, useRef } from 'react';

interface VideoPlayerProps {
  videoUrl: string | null;
  videoBlob?: Blob | null;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUrl, videoBlob }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Handle video loading
  useEffect(() => {
    console.log("VideoPlayer: Loading video from URL", videoUrl);
    if (!videoUrl) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setErrorDetails(null);

    // Use a timeout to detect if video loading takes too long
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        console.warn("Video preview loading timeout");
        setError("Preview loading timeout");
        setErrorDetails("Browser may not support this format");
      }
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, [videoUrl, isLoading]);

  // Handle when video can be played
  const handleCanPlay = () => {
    console.log("VideoPlayer: Video can play");
    setIsLoading(false);
    setError(null);
  };

  // Handle video errors
  const handleError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error("VideoPlayer: Error playing video", e);
    setIsLoading(false);
    setError("Unable to play this video in browser");
    setErrorDetails(`Format may not be supported: ${videoRef.current?.error?.message || 'Unknown error'}`);
    
    // Try to recreate URL from blob as a fallback
    if (videoBlob && videoRef.current) {
      try {
        console.log("Trying fallback with direct blob URL");
        const newUrl = URL.createObjectURL(videoBlob);
        videoRef.current.src = newUrl;
      } catch (err) {
        console.error("Failed to create fallback URL:", err);
      }
    }
  };

  const handleDownload = () => {
    if (!videoUrl) return;
    
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
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
      
      <div className="mt-4 flex justify-center">
        <button
          onClick={handleDownload}
          className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg inline-block"
          disabled={!videoUrl}
        >
          Download Video File ↓
        </button>
      </div>
    </div>
  );
};

export default VideoPlayer; 