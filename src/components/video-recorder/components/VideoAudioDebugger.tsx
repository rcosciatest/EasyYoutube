import React, { useRef, useEffect, useState } from 'react';

interface VideoAudioDebuggerProps {
  videoUrl: string | null;
  videoBlob: Blob | null;
}

const VideoAudioDebugger: React.FC<VideoAudioDebuggerProps> = ({ videoUrl, videoBlob }) => {
  const [audioInfo, setAudioInfo] = useState<string>("Analyzing...");
  const [audioTracks, setAudioTracks] = useState<number>(0);
  const [videoTracks, setVideoTracks] = useState<number>(0);
  const [audioBitrate, setAudioBitrate] = useState<string>("Unknown");
  const [codecInfo, setCodecInfo] = useState<string>("Unknown");
  const testVideoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    if (!videoUrl || !videoBlob) {
      setAudioInfo("No video available");
      return;
    }
    
    const analyzeVideo = async () => {
      try {
        // First, basic blob information
        setAudioInfo(`Analyzing blob of type ${videoBlob.type}, size ${(videoBlob.size/1024/1024).toFixed(2)}MB`);
        
        // Create a video element to test the media
        if (testVideoRef.current) {
          testVideoRef.current.src = videoUrl;
          
          // Listen for metadata to check tracks
          testVideoRef.current.onloadedmetadata = () => {
            const video = testVideoRef.current;
            if (!video) return;
            
            try {
              if ('audioTracks' in video) {
                setAudioTracks((video as any).audioTracks.length);
              }
              
              if ('videoTracks' in video) {
                setVideoTracks((video as any).videoTracks.length);
              }
              
              // WebM can theoretically be analyzed further, but browser APIs have limitations
              // MediaCapabilities API would be ideal, but it doesn't expose track info
              
              setAudioInfo(`Media analysis complete. Duration: ${video.duration.toFixed(1)}s`);
              
              // Check if audio is actually playing
              video.volume = 1.0;
              video.muted = false;
              video.currentTime = Math.min(video.duration / 2, 5); // Jump to middle or 5 seconds
              
              const playPromise = video.play();
              if (playPromise) {
                playPromise.then(() => {
                  // Set a timeout to check audio levels
                  setTimeout(() => {
                    // At this point, audio should be playing if present
                    setAudioInfo(prev => prev + ". Audio playback test: complete");
                    video.pause();
                  }, 1000);
                }).catch(e => {
                  setAudioInfo(prev => prev + `. Audio playback test failed: ${e.message}`);
                });
              }
            } catch (e) {
              setAudioInfo(`Error analyzing media: ${e instanceof Error ? e.message : String(e)}`);
            }
          };
          
          testVideoRef.current.onerror = () => {
            setAudioInfo(`Error loading video for analysis: ${testVideoRef.current?.error?.message || 'Unknown error'}`);
          };
          
          // Force load
          testVideoRef.current.load();
        }
      } catch (e) {
        setAudioInfo(`Analysis failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    };
    
    analyzeVideo();
  }, [videoUrl, videoBlob]);
  
  return (
    <div className="mt-2 p-3 bg-gray-900 text-green-400 rounded font-mono text-xs">
      <h4 className="font-bold mb-1">Audio Debug Analysis</h4>
      <div>{audioInfo}</div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div>Audio Tracks: {audioTracks}</div>
        <div>Video Tracks: {videoTracks}</div>
        <div>Audio Bitrate: {audioBitrate}</div>
        <div>Codec: {codecInfo}</div>
      </div>
      <div className="hidden">
        <video ref={testVideoRef} preload="metadata" />
      </div>
    </div>
  );
};

export default VideoAudioDebugger; 