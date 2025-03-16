import React, { useState, useRef, useEffect } from 'react';
import Teleprompter from './Teleprompter';
import { downloadVideo as downloadVideoUtil } from '../utils/download_utils';

interface VideoRecorderProps {
  script: string;
}

const VideoRecorder: React.FC<VideoRecorderProps> = ({ script }) => {
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [teleprompterPosition, setTeleprompterPosition] = useState<'overlay' | 'side' | 'bottom'>('overlay');
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTeleprompter, setShowTeleprompter] = useState<boolean>(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'full' | 'split'>('full');
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const circleWebcamRef = useRef<HTMLVideoElement>(null);
  
  // Get supported MIME type
  const getSupportedMimeType = () => {
    const types = [
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4'
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    
    return 'video/webm'; // Fallback
  };
  
  // Initialize camera
  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true,
          audio: true 
        });
        
        console.log("Camera stream obtained");
        
        // Set stream to main video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(e => 
            console.error("Error playing main webcam:", e)
          );
        }
        
        // Also set stream to circle webcam ref
        if (circleWebcamRef.current) {
          circleWebcamRef.current.srcObject = stream;
          await circleWebcamRef.current.play().catch(e => 
            console.error("Error playing circle webcam:", e)
          );
        }
        
        streamRef.current = stream;
        setCameraPermission(true);
      } catch (err) {
        console.error('Camera permission error:', err);
        setCameraPermission(false);
        setError('Camera access denied. Please enable camera permissions for this site.');
      }
    };
    
    initCamera();
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  // Start recording function
  const startRecording = async () => {
    if (!streamRef.current) {
      setError('Camera stream not available');
      return;
    }

    try {
      setRecordedChunks([]);
      chunksRef.current = [];
      
      // Create a canvas for compositing the final video
      const canvas = document.createElement('canvas');
      canvas.width = 1280;  // 720p width
      canvas.height = 720;  // 720p height
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        setError('Could not create recording context');
        return;
      }
      
      // Create a stream from the canvas
      const canvasStream = canvas.captureStream(30); // 30 FPS
      
      // Add audio from webcam to canvas stream
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        canvasStream.addTrack(audioTrack);
      }
      
      // Reference to video elements
      const webcamVideo = videoRef.current;
      const circleVideo = circleWebcamRef.current;
      const screenVideo = screenVideoRef.current;
      
      // Animation frame for drawing to canvas
      const drawFrame = () => {
        // Clear the canvas first
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        if (viewMode === 'full') {
          // Full webcam view
          if (webcamVideo) {
            ctx.drawImage(webcamVideo, 0, 0, canvas.width, canvas.height);
          }
        } else {
          // Tutorial view with screen + webcam overlay
          if (screenVideo && screenVideo.srcObject) {
            // Draw screen as background
            ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
            
            // Draw circular webcam in corner
            if (circleVideo) {
              const circleSize = Math.round(canvas.width * 0.25);
              const x = canvas.width - circleSize - 20;
              const y = canvas.height - circleSize - 20;
              
              // Draw circle
              ctx.save();
              ctx.beginPath();
              ctx.arc(x + circleSize/2, y + circleSize/2, circleSize/2, 0, Math.PI * 2);
              ctx.closePath();
              ctx.clip();
              
              // Draw webcam
              ctx.drawImage(circleVideo, x, y, circleSize, circleSize);
              
              // Draw circle border
              ctx.beginPath();
              ctx.arc(x + circleSize/2, y + circleSize/2, circleSize/2, 0, Math.PI * 2);
              ctx.lineWidth = 4;
              ctx.strokeStyle = 'white';
              ctx.stroke();
              ctx.restore();
            }
          } else if (webcamVideo) {
            // Fallback to webcam if screen capture isn't available
            ctx.drawImage(webcamVideo, 0, 0, canvas.width, canvas.height);
          }
        }
        
        // Continue drawing if still recording
        if (recordingState === 'recording' || recordingState === 'paused') {
          animFrameRef.current = requestAnimationFrame(drawFrame);
        }
      };
      
      // Start drawing
      animFrameRef.current = requestAnimationFrame(drawFrame);
      
      // Use a more compatible MIME type
      const mimeType = 'video/webm;codecs=vp8,opus';
      
      // Set up MediaRecorder with the canvas stream
      const options = {
        mimeType: mimeType,
        videoBitsPerSecond: 2500000 // 2.5 Mbps
      };
      
      mediaRecorderRef.current = new MediaRecorder(canvasStream, options);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
          setRecordedChunks(prev => [...prev, event.data]);
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        // Clean up animation frame
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
        }
        
        // Create blob from chunks
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setVideoBlob(blob);
      };
      
      // Start recording
      mediaRecorderRef.current.start(1000); // Collect data every second
      setRecordingState('recording');
      
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Could not start recording: ' + (err instanceof Error ? err.message : String(err)));
    }
  };
  
  // Pause recording function
  const pauseRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      try {
        mediaRecorderRef.current.pause();
        setRecordingState('paused');
      } catch (err) {
        console.error('Error pausing recording:', err);
        setError('Could not pause recording');
      }
    }
  };
  
  // Stop recording function
  const stopRecording = async () => {
    if (!mediaRecorderRef.current) {
      setError('No active recording');
      return;
    }
    
    try {
      mediaRecorderRef.current.stop();
      
      // Clean up animation frame if it exists
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      
      setRecordingState('idle');
    } catch (err) {
      console.error('Error stopping recording:', err);
      setError('Error finalizing video: ' + (err instanceof Error ? err.message : String(err)));
    }
  };
  
  // Download the recorded video
  const downloadVideo = () => {
    setDownloadStatus('Preparing video for download...');
    
    downloadVideoUtil(
      videoUrl,
      recordedChunks,
      getSupportedMimeType,
      (status) => setDownloadStatus(status),
      (errorMsg) => setError(errorMsg)
    );
  };
  
  // Toggle teleprompter position
  const toggleTeleprompterPosition = () => {
    // If teleprompter is hidden, show it
    if (!showTeleprompter) {
      setShowTeleprompter(true);
      return;
    }
    
    // Otherwise cycle through positions
    const positions: ('overlay' | 'side' | 'bottom')[] = ['overlay', 'side', 'bottom'];
    const currentIndex = positions.indexOf(teleprompterPosition);
    const nextIndex = (currentIndex + 1) % positions.length;
    setTeleprompterPosition(positions[nextIndex]);
  };
  
  // Start screen capture
  const startScreenCapture = async () => {
    try {
      console.log("Starting screen capture...");
      
      // Stop any existing screen capture
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        setScreenStream(null);
      }
      
      // Request new screen capture
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      
      console.log("Screen capture stream obtained");
      
      // Set the stream to state
      setScreenStream(stream);
      
      // Ensure the video element gets the stream
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        
        // Make sure the video plays
        try {
          await screenVideoRef.current.play();
          console.log("Screen video now playing");
        } catch (e) {
          console.error("Error playing screen video:", e);
        }
        
        // Add event listener for when screen sharing ends
        stream.getVideoTracks()[0].onended = () => {
          console.log("Screen sharing ended by user");
          setScreenStream(null);
          setViewMode('full'); // Switch back to full view
        };
      } else {
        console.error("screenVideoRef is null");
      }
      
      return stream;
    } catch (err) {
      console.error('Error capturing screen:', err);
      
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Screen capture permission denied. Please allow screen sharing to use tutorial view.');
      } else {
        setError('Could not capture screen: ' + (err instanceof Error ? err.message : String(err)));
      }
      
      return null;
    }
  };
  
  // Modify view mode
  const toggleViewMode = (mode: 'full' | 'split') => {
    console.log(`Toggling to ${mode} mode`);
    
    // First set the view mode to provide immediate feedback
    setViewMode(mode);
    
    if (mode === 'split') {
      // Only request screen capture if we don't already have it
      if (!screenStream || !screenStream.active) {
        startScreenCapture().then(stream => {
          if (!stream) {
            console.log("Screen capture failed, reverting to full view");
            setViewMode('full');
          }
        });
      }
    }
    
    // Make sure webcam is still playing in both video elements
    if (videoRef.current && videoRef.current.srcObject && 
        videoRef.current.paused) {
      videoRef.current.play().catch(e => 
        console.error("Error playing main webcam:", e)
      );
    }
    
    if (circleWebcamRef.current && circleWebcamRef.current.srcObject && 
        circleWebcamRef.current.paused) {
      circleWebcamRef.current.play().catch(e => 
        console.error("Error playing circle webcam:", e)
      );
    }
  };
  
  // Add cleanup for screen capture
  useEffect(() => {
    return () => {
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [screenStream]);

  // Add keyboard event handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        toggleViewMode('split');
      } else if (event.key === 'ArrowLeft') {
        toggleViewMode('full');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [screenStream]); // Add screenStream as dependency to avoid requesting it multiple times
  
  // Add cleanup for animation frame
  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);
  
  // Add cleanup for video URL
  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);
  
  // Add this effect to ensure video elements always have proper streams
  useEffect(() => {
    // Function to ensure video elements have the correct streams
    const checkAndRestoreVideoSources = () => {
      const webcamStream = streamRef.current;
      
      if (webcamStream) {
        // Make sure main video has webcam stream
        if (viewMode === 'full' && videoRef.current && !videoRef.current.srcObject) {
          console.log("Restoring main webcam stream");
          videoRef.current.srcObject = webcamStream;
          videoRef.current.play().catch(e => console.error("Error playing restored main webcam:", e));
        }
        
        // Make sure circle/square video has webcam stream in tutorial view
        if (viewMode === 'split' && circleWebcamRef.current && !circleWebcamRef.current.srcObject) {
          console.log("Restoring circle webcam stream");
          circleWebcamRef.current.srcObject = webcamStream;
          circleWebcamRef.current.play().catch(e => console.error("Error playing restored circle webcam:", e));
        }
      }
      
      // Check screen video in tutorial view
      if (viewMode === 'split' && screenStream && screenVideoRef.current && !screenVideoRef.current.srcObject) {
        console.log("Restoring screen capture stream");
        screenVideoRef.current.srcObject = screenStream;
        screenVideoRef.current.play().catch(e => console.error("Error playing restored screen video:", e));
      }
    };

    // Check immediately when view mode changes
    checkAndRestoreVideoSources();
    
    // Also set up interval to periodically check (helps with browser quirks)
    const intervalId = setInterval(checkAndRestoreVideoSources, 2000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [viewMode, screenStream]);
  
  // Render
  return (
    <div className="container mx-auto px-4 py-6">
      <h2 className="text-2xl font-bold mb-6">Record Your Video</h2>
      
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded">
          <p>{error}</p>
          <button 
            className="underline mt-1"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}
      
      <div className="flex flex-col md:flex-row gap-6">
        {/* Main content with video templates */}
        <div className="w-full md:w-2/3">
          <div className="w-full">
            {/* Error message with retry button */}
            {error && error.includes('screen capture') && (
              <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-md text-red-700 flex justify-between items-center">
                <span>{error}</span>
                <button 
                  onClick={() => toggleViewMode('split')}
                  className="ml-4 px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Retry
                </button>
              </div>
            )}

            <div 
              className="relative rounded-lg overflow-hidden"
              style={{
                aspectRatio: '16/9',
                maxHeight: '70vh',
                backgroundColor: 'black'
              }}
            >
              {viewMode === 'full' ? (
                // Full camera view
                <video 
                  ref={videoRef}
                  autoPlay 
                  muted 
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                // Tutorial view with screen capture + circular webcam
                <div className="relative w-full h-full">
                  {/* Screen capture background */}
                  <video
                    ref={screenVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-contain"
                  />
                  
                  {/* Circular webcam overlay */}
                  <div 
                    className="absolute overflow-hidden border-4 border-white shadow-lg z-10"
                    style={{
                      width: '25%',
                      height: 'auto',
                      aspectRatio: '1/1',
                      bottom: '20px',
                      right: '20px',
                      borderRadius: '8px'
                    }}
                  >
                    <video
                      ref={circleWebcamRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}
              
              {/* Teleprompter overlay */}
              {showTeleprompter && (
                <Teleprompter 
                  script={script} 
                  position={teleprompterPosition}
                  onClose={() => setShowTeleprompter(false)}
                />
              )}
            </div>
            
            {/* View mode controls */}
            <div className="mt-2 flex justify-between items-center">
              <div className="flex">
                <button 
                  onClick={() => toggleViewMode('full')}
                  className={`px-3 py-1 rounded-l-md text-sm ${viewMode === 'full' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                >
                  <span className="mr-1">←</span> Full Camera
                </button>
                <button 
                  onClick={() => toggleViewMode('split')}
                  className={`px-3 py-1 rounded-r-md text-sm ${viewMode === 'split' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                >
                  Tutorial View <span className="ml-1">→</span>
                </button>
              </div>
              <div className="text-xs text-gray-500">
                Use arrow keys to switch views
              </div>
            </div>
            
            <div className="mt-4 flex flex-wrap gap-2">
              {recordingState === 'idle' ? (
                <button
                  onClick={startRecording}
                  disabled={!cameraPermission}
                  className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg disabled:opacity-50"
                >
                  Start Recording
                </button>
              ) : recordingState === 'recording' ? (
                <>
                  <button
                    onClick={pauseRecording}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-4 rounded-lg"
                  >
                    Pause
                  </button>
                  <button
                    onClick={stopRecording}
                    className="bg-gray-700 hover:bg-gray-800 text-white py-2 px-4 rounded-lg"
                  >
                    Stop Recording
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={startRecording}
                    className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg"
                  >
                    Resume
                  </button>
                  <button
                    onClick={stopRecording}
                    className="bg-gray-700 hover:bg-gray-800 text-white py-2 px-4 rounded-lg"
                  >
                    Stop Recording
                  </button>
                </>
              )}
              
              <button
                onClick={toggleTeleprompterPosition}
                className={`py-2 px-4 rounded-lg ${
                  showTeleprompter 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                }`}
              >
                {showTeleprompter ? `Teleprompter (${teleprompterPosition})` : 'Show Teleprompter'}
              </button>
              
              {showTeleprompter && (
                <button
                  onClick={() => setShowTeleprompter(false)}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-lg"
                >
                  Hide Teleprompter
                </button>
              )}
              
              {videoUrl && (
                <button
                  onClick={downloadVideo}
                  className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg"
                >
                  Download Video
                </button>
              )}
            </div>
          </div>
          
          {downloadStatus && (
            <div className="mt-2 text-sm text-gray-700">
              {downloadStatus}
            </div>
          )}

          {/* Add this right below the video container */}
          <div className="mt-2 text-xs text-gray-500">
            <details>
              <summary>Debug Info</summary>
              <p>View Mode: {viewMode}</p>
              <p>Main Webcam: {videoRef.current?.srcObject ? 'Set' : 'Not set'}</p>
              <p>Main Webcam Paused: {videoRef.current?.paused ? 'Yes' : 'No'}</p>
              <p>Circle Webcam: {circleWebcamRef.current?.srcObject ? 'Set' : 'Not set'}</p>
              <p>Circle Webcam Paused: {circleWebcamRef.current?.paused ? 'Yes' : 'No'}</p>
              <p>Screen Stream: {screenStream ? 'Active' : 'Not active'}</p>
              <p>Screen Tracks: {screenStream?.getTracks().length || 0}</p>
              <p>Screen Video: {screenVideoRef.current?.srcObject ? 'Set' : 'Not set'}</p>
              <p>Screen Video Paused: {screenVideoRef.current?.paused ? 'Yes' : 'No'}</p>
            </details>
          </div>
        </div>
        
        {/* Preview area */}
        <div className="w-full md:w-1/3">
          {videoUrl ? (
            <div className="space-y-4">
              <MediaPlayer 
                videoUrl={videoUrl} 
                onError={(message) => {
                  console.error('MediaPlayer error:', message);
                  setError(message);
                }}
              />
              <details className="mt-2 text-xs text-gray-500">
                <summary>Debug Info</summary>
                <p>Recorded chunks: {recordedChunks.length}</p>
                <p>Total size: {(recordedChunks.reduce((acc, chunk) => acc + chunk.size, 0) / (1024 * 1024)).toFixed(2)} MB</p>
                <p>First chunk type: {recordedChunks[0]?.type || 'unknown'}</p>
                <p>Audio tracks in original stream: {streamRef.current?.getAudioTracks().length || 0}</p>
              </details>
            </div>
          ) : (
            <div className="bg-gray-100 p-4 rounded-lg h-full">
              <h3 className="font-semibold mb-2">Preview</h3>
              <p className="text-gray-500 mb-4">Your recorded video will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Define the MediaPlayer component at the bottom of the file
interface MediaPlayerProps {
  videoUrl: string | null;
  onError?: (message: string) => void;
}

// Use named export to avoid naming conflicts
export const MediaPlayer: React.FC<MediaPlayerProps> = ({ videoUrl, onError = () => {} }) => {
  const [useAudioPlayer, setUseAudioPlayer] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleError = (message: string) => {
    setError(message);
    onError(message);
  };

  if (!videoUrl) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Recording Preview</h3>
      {!useAudioPlayer ? (
        <video 
          src={videoUrl} 
          controls 
          className="w-full rounded-lg shadow-sm"
          playsInline
          preload="metadata"
          onError={(e) => {
            console.error('Video preview error:', e);
            handleError('Error playing the video. Switching to audio-only player.');
            setUseAudioPlayer(true);
          }}
        />
      ) : (
        <div className="bg-gray-100 p-4 rounded-lg">
          <p className="mb-2 text-sm text-gray-600">Video preview not available. Audio only:</p>
          <audio 
            src={videoUrl} 
            controls 
            className="w-full"
            onError={(e) => {
              console.error('Audio preview error:', e);
              handleError('Unable to play the recording. Please try downloading it instead.');
            }}
          />
        </div>
      )}
      
      {error && (
        <div className="text-red-500 text-sm mt-2">
          {error}
        </div>
      )}
    </div>
  );
};

// This extends the MediaTrackConstraintSet interface to include displaySurface
interface MediaTrackConstraintSet {
  displaySurface?: 'monitor' | 'window' | 'application' | 'browser';
  cursor?: 'always' | 'motion' | 'never';
}

export default VideoRecorder; 