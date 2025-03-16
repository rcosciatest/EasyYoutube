import React, { useState, useRef, useEffect } from 'react';
import Teleprompter from './Teleprompter';
import { downloadVideo as downloadVideoUtil } from '../utils/download_utils';

interface VideoRecorderProps {
  script: string;
}

// Add interface to extend CanvasRenderingContext2D
interface CanvasRenderingContext2DExtended extends CanvasRenderingContext2D {
  roundRect(x: number, y: number, width: number, height: number, radius: number | number[]): CanvasRenderingContext2D;
}

// Add this polyfill before using the canvas
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(
    x: number, 
    y: number, 
    width: number, 
    height: number, 
    radius: number | number[]
  ): CanvasRenderingContext2D {
    // Handle radius as array or single number
    let radiusX: number;
    let radiusY: number;
    
    if (typeof radius === 'number') {
      radiusX = radiusY = radius;
    } else if (radius instanceof Array) {
      // If radius is an array but empty, default to 0
      if (radius.length === 0) {
        radiusX = radiusY = 0;
      } else {
        // Use the first value from the array
        radiusX = radiusY = radius[0];
      }
    } else {
      // Default to 0 if undefined or invalid
      radiusX = radiusY = 0;
    }

    // Apply maximum radius constraints
    if (width < 2 * radiusX) radiusX = width / 2;
    if (height < 2 * radiusY) radiusY = height / 2;
    
    // Draw rounded rectangle
    this.beginPath();
    this.moveTo(x + radiusX, y);
    this.arcTo(x + width, y, x + width, y + height, radiusX);
    this.arcTo(x + width, y + height, x, y + height, radiusY);
    this.arcTo(x, y + height, x, y, radiusY);
    this.arcTo(x, y, x + width, y, radiusX);
    this.closePath();
    return this;
  };
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
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [canvasStream, setCanvasStream] = useState<MediaStream | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const circleWebcamRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<number | null>(null);
  
  // Get supported MIME type
  const getSupportedMimeType = () => {
    // Try these formats in order of preference
    const types = [
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4;codecs=h264,aac',
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
    const initWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        console.log("Webcam stream obtained");
        streamRef.current = stream;
        
        // Set the stream to both video elements
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        
        if (circleWebcamRef.current) {
          circleWebcamRef.current.srcObject = stream;
          await circleWebcamRef.current.play();
        }
        
        setCameraPermission(true);
        setError(null);
      } catch (err) {
        console.error('Error accessing camera and microphone:', err);
        setCameraPermission(false);
        setError('Could not access camera and microphone. Please ensure you have given permission.');
      }
    };
    
    initWebcam();
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  // Start recording function
  const startRecording = async () => {
    try {
      // Reset state
      chunksRef.current = [];
      setRecordedChunks([]);
      setError(null);
      setRecordingDuration(0);
      
      // Get fresh composite stream
      const finalStream = getFinalStream();
      if (!finalStream) {
        throw new Error('Failed to get recording stream');
      }
      
      // Store the canvas stream for later cleanup
      setCanvasStream(finalStream);
      
      // Get optimal MIME type
      const mimeType = getSupportedMimeType();
      console.log(`Using recording format: ${mimeType} for ${viewMode} view`);
      
      // Configure recorder with better quality settings
      const mediaRecorder = new MediaRecorder(finalStream, {
        mimeType: mimeType,
        videoBitsPerSecond: 2500000, // Higher bitrate for better quality
        audioBitsPerSecond: 128000
      });
      
      // Handle data chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          console.log(`Received chunk: ${(event.data.size / 1024).toFixed(2)} KB`);
          chunksRef.current.push(event.data);
        }
      };
      
      // Handle recording completion
      mediaRecorder.onstop = () => {
        console.log(`Recording completed with ${chunksRef.current.length} chunks`);
        
        // Clean up animation loop
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
        
        // Clean up old video URL
        if (videoUrl) {
          URL.revokeObjectURL(videoUrl);
        }
        
        if (chunksRef.current.length === 0) {
          console.error('No data recorded');
          setError('No video data was captured. Please try again.');
          setRecordingState('idle');
          return;
        }
        
        // Create final video blob
        const blob = new Blob(chunksRef.current, { type: mimeType });
        console.log(`Video size: ${(blob.size / (1024 * 1024)).toFixed(2)} MB`);
        
        setVideoBlob(blob);
        setRecordedChunks([...chunksRef.current] as Blob[]);
        
        // Create URL for playback
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setRecordingState('idle');
      };
      
      // Start recording with small chunks (250ms) to better handle view changes
      mediaRecorder.start(250);
      mediaRecorderRef.current = mediaRecorder;
      
      // Start timer
      startTimer();
      
      console.log('Recording started');
      setRecordingState('recording');
    } catch (err) {
      console.error('Error starting recording:', err);
      setError(`Recording failed: ${err instanceof Error ? err.message : String(err)}`);
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
  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      console.log('Stopping recording...');
      // Request one final chunk of data
      mediaRecorderRef.current.requestData();
      
      // Small timeout to ensure data is processed
      setTimeout(() => {
        mediaRecorderRef.current?.stop();
        stopTimer();
        
        // Reset the recorder view
        setRecordingState('idle');
      }, 100);
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
  
  // Add this utility function
  const ensureVideoStreams = () => {
    console.log("Ensuring all video streams are properly connected");
    
    // Ensure webcam is properly connected to both video elements
    if (streamRef.current) {
      if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(e => console.error("Error playing main webcam:", e));
      }
      
      if (circleWebcamRef.current && circleWebcamRef.current.srcObject !== streamRef.current) {
        circleWebcamRef.current.srcObject = streamRef.current;
        circleWebcamRef.current.play().catch(e => console.error("Error playing circle webcam:", e));
      }
    }
    
    // Ensure screen stream is connected
    if (screenStream && screenVideoRef.current && screenVideoRef.current.srcObject !== screenStream) {
      screenVideoRef.current.srcObject = screenStream;
      screenVideoRef.current.play().catch(e => console.error("Error playing screen capture:", e));
    }
  };
  
  // Update toggleViewMode to call this function
  const toggleViewMode = (mode: 'full' | 'split') => {
    console.log(`Toggling view mode: ${viewMode} → ${mode}`);
    
    // Set view mode immediately for UI feedback
    setViewMode(mode);
    
    if (mode === 'split') {
      if (!screenStream || !screenStream.active) {
        // Need to start screen capture
        startScreenCapture().then(stream => {
          if (!stream) {
            console.error("Screen capture failed - reverting to full view");
            setViewMode('full');
          } else {
            // Ensure streams are properly connected
            setTimeout(ensureVideoStreams, 100);
          }
        });
      } else {
        // Already have screen stream, just ensure connections
        setTimeout(ensureVideoStreams, 100);
      }
    }
    
    // Always ensure webcam streams are properly set
    ensureVideoStreams();
    
    // If we're recording, log a marker
    if (recordingState === 'recording') {
      console.log(`View changed during recording: ${viewMode} → ${mode}`);
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
  
  // Move the codec support useEffect here, alongside your other useEffects
  useEffect(() => {
    console.log("Browser codec support:");
    const codecs = [
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=h264,opus',
      'video/mp4;codecs=h264,aac'
    ];
    
    codecs.forEach(codec => {
      console.log(`${codec}: ${MediaRecorder.isTypeSupported(codec) ? 'Supported' : 'Not supported'}`);
    });
  }, []);
  
  const debugMediaRecorderState = () => {
    if (!mediaRecorderRef.current) {
      console.log('MediaRecorder not initialized');
      return;
    }
    
    console.log({
      state: mediaRecorderRef.current.state,
      mimeType: mediaRecorderRef.current.mimeType,
      videoBitsPerSecond: mediaRecorderRef.current.videoBitsPerSecond,
      audioBitsPerSecond: mediaRecorderRef.current.audioBitsPerSecond,
      stream: mediaRecorderRef.current.stream.active ? 'active' : 'inactive',
      chunksCollected: chunksRef.current.length
    });
  };
  
  // Add this function before startRecording()
  const getFinalStream = (): MediaStream | null => {
    console.log('Getting final stream, view mode:', viewMode);
    
    // Create a composite stream that will reflect UI changes during recording
    const compositeStream = createCompositeStream();
    
    // Add audio from the webcam stream
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        compositeStream.addTrack(audioTracks[0]);
      }
    }
    
    return compositeStream;
  };
  
  // Add this helper function
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Add these timer functions
  const startTimer = () => {
    // Reset the timer
    setRecordingDuration(0);
    
    // Start the timer interval
    const startTime = Date.now();
    timerRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setRecordingDuration(elapsed);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Add cleanup in useEffect
  useEffect(() => {
    return () => {
      // Clean up timer when component unmounts
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);
  
  // Update the canvas stream capture to use a lower framerate for more consistent results
  const createCompositeStream = (): MediaStream => {
    // Create a canvas element at the right size
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set initial canvas dimensions to HD quality
    canvas.width = 1280;
    canvas.height = 720;
    
    // Keep track of current view mode for debugging
    let currentViewMode = viewMode;
    
    // Function to draw the current view to canvas
    const drawToCanvas = () => {
      if (!ctx) return;
      
      // Log if view mode changed
      if (currentViewMode !== viewMode) {
        console.log(`Canvas detected view change: ${currentViewMode} → ${viewMode}`);
        currentViewMode = viewMode;
      }
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      try {
        if (viewMode === 'full') {
          // Draw the webcam video full screen
          if (videoRef.current && videoRef.current.readyState >= 2) {
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          } else {
            // Black background as fallback
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
        } else if (viewMode === 'split') {
          // Draw screen capture background
          if (screenVideoRef.current && screenVideoRef.current.readyState >= 2) {
            ctx.drawImage(screenVideoRef.current, 0, 0, canvas.width, canvas.height);
          } else {
            // Light gray background as fallback
            ctx.fillStyle = "#f0f0f0";
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
            ctx.roundRect(x, y, size, size, 8);
            ctx.clip();
            ctx.drawImage(circleWebcamRef.current, x, y, size, size);
            ctx.restore();
          }

        }
      } catch (err) {
        console.error("Error drawing to canvas:", err);
      }
      
      // Continue the loop - using 20fps for more reliable encoding
      animFrameRef.current = requestAnimationFrame(drawToCanvas);
    };
    
    // Start the draw loop
    drawToCanvas();
    
    // Use a slightly lower framerate (20fps) for more consistent results
    return canvas.captureStream(20);
  };
  
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

            {recordingState === 'recording' && (
              <div className="text-red-500 font-medium">
                Recording: {formatTime(recordingDuration)}
              </div>
            )}
          </div>
          
          {downloadStatus && (
            <div className="mt-2 text-sm text-gray-700">
              {downloadStatus}
            </div>
          )}

          {/* Debug info section */}
          <details className="mt-2 text-xs text-gray-500">
            <summary>Debug Info</summary>
            <div className="pl-4 pt-2">
              <p>View Mode: {viewMode}</p>
              <p>Recording State: {recordingState}</p>
              <p>Camera Permission: {cameraPermission ? 'Granted' : 'Denied'}</p>
              <p>Screen Stream: {screenStream ? 'Active' : 'Not active'}</p>
              <p>Video URL: {videoUrl ? 'Created' : 'Not created'}</p>
              <p>Video Blob Size: {videoBlob?.size ? `${Math.round(videoBlob.size / 1024)} KB` : 'N/A'}</p>
              <p>Video Blob Type: {videoBlob?.type || 'N/A'}</p>
              <p>MIME Type: {getSupportedMimeType()}</p>
              <p>Recorded Chunks: {recordedChunks.length}</p>
              <p>Browser: {navigator.userAgent}</p>
            </div>
          </details>
        </div>
        
        {/* Preview area */}
        <div className="w-full md:w-1/3">
          {videoUrl ? (
            <div>
              <VideoPlayer videoUrl={videoUrl} />
              
              <DiagnosticTool videoBlob={videoBlob} />
              
              <details className="mt-2 text-xs text-gray-500">
                <summary>Debug Info</summary>
                <div className="pl-4 pt-2">
                  <p>View Mode: {viewMode}</p>
                  <p>Recorded Chunks: {recordedChunks.length}</p>
                  <p>Video Size: {videoBlob ? `${(videoBlob.size / (1024 * 1024)).toFixed(2)} MB` : 'N/A'}</p>
                  <p>MIME Type: video/webm;codecs=vp8,opus</p>
                  <p>Last View Change: {new Date().toLocaleTimeString()}</p>
                </div>
              </details>
            </div>
          ) : (
            <div className="bg-gray-100 p-4 rounded-lg">
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
  const [playerState, setPlayerState] = useState<'loading' | 'video' | 'audio' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoUrl) return;
    
    setPlayerState('loading');
    setError(null);
    
    // Force browser to reload the video source
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [videoUrl]);

  const handleError = (message: string) => {
    console.error(`Media player error: ${message}`);
    setError(message);
    onError(message);
  };

  const handleVideoError = () => {
    console.warn('Video playback failed, trying audio-only playback');
    setPlayerState('audio');
  };

  const handleAudioError = () => {
    setPlayerState('error');
    handleError('Unable to play the recording. Please try downloading it instead.');
  };

  if (!videoUrl) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Recording Preview</h3>
      
      {playerState === 'loading' && (
        <div className="py-8 flex justify-center items-center bg-gray-100 rounded-lg">
          <p>Loading preview...</p>
        </div>
      )}
      
      {(playerState === 'loading' || playerState === 'video') && (
        <video 
          ref={videoRef}
          src={videoUrl} 
          controls 
          className={`w-full rounded-lg shadow-sm ${playerState === 'loading' ? 'hidden' : ''}`}
          playsInline
          preload="auto"
          autoPlay
          onCanPlay={() => setPlayerState('video')}
          onError={handleVideoError}
        />
      )}
      
      {playerState === 'audio' && (
        <div className="bg-gray-100 p-4 rounded-lg">
          <p className="mb-2 text-sm text-gray-600">Video preview not available. Audio only:</p>
          <audio 
            src={videoUrl} 
            controls 
            className="w-full"
            autoPlay
            onError={handleAudioError}
          />
        </div>
      )}
      
      {playerState === 'error' && (
        <div className="bg-red-100 p-4 rounded-lg">
          <p className="text-red-700">
            Could not play the recording. Please try downloading the video instead.
          </p>
        </div>
      )}
      
      {/* Direct link to video as fallback */}
      {videoUrl && (
        <div className="text-xs text-gray-500">
          <a 
            href={videoUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:underline"
          >
            Open video in new tab
          </a>
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

// Complete replacement for VideoPlayer component
const VideoPlayer: React.FC<{ videoUrl: string | null }> = ({ videoUrl }) => {
  const [playerState, setPlayerState] = useState<'loading' | 'video' | 'audio' | 'error'>('loading');
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    if (!videoUrl) {
      setPlayerState('loading');
      return;
    }
    
    setPlayerState('loading');
    setErrorDetails(null);
    
    // Reset playback element for clean state
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
    
    // Cleanup
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
      }
    };
  }, [videoUrl]);
  
  const handleVideoCanPlay = () => {
    console.log("Video can play");
    setPlayerState('video');
  };
  
  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error("Video playback error:", e);
    
    // Get details from error event
    const videoElement = e.target as HTMLVideoElement;
    let errorMsg = "Unknown error";
    
    if (videoElement.error) {
      const errorCode = videoElement.error.code;
      const errorCodes = ["MEDIA_ERR_ABORTED", "MEDIA_ERR_NETWORK", "MEDIA_ERR_DECODE", "MEDIA_ERR_SRC_NOT_SUPPORTED"];
      errorMsg = errorCodes[errorCode - 1] || "Unknown error code";
      
      if (videoElement.error.message) {
        errorMsg += `: ${videoElement.error.message}`;
      }
    }
    
    setErrorDetails(errorMsg);
    setPlayerState('error');
  };
  
  return (
    <div className="mt-4">
      <h3 className="text-lg font-medium pb-2">Recording Preview</h3>
      
      {playerState === 'loading' && (
        <div className="py-4 text-center bg-gray-100 rounded-lg mb-2">
          <span className="inline-block">Loading video preview...</span>
        </div>
      )}
      
      <div className="bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={videoUrl || undefined}
          className="w-full"
          controls
          playsInline
          preload="auto"
          onCanPlay={handleVideoCanPlay}
          onError={handleVideoError}
        />
      </div>
      
      {playerState === 'error' && (
        <div className="mt-2 p-3 bg-red-100 text-red-700 rounded">
          <p><strong>Video preview unavailable in this browser</strong></p>
          <p className="text-sm mt-1">Please download the video to view properly.</p>
          {errorDetails && (
            <p className="text-xs mt-1 text-gray-700">Technical details: {errorDetails}</p>
          )}
        </div>
      )}
      
      {videoUrl && (
        <div className="mt-4 flex justify-center">
          <a 
            href={videoUrl} 
            download="screen_recording.webm" 
            className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg inline-block"
          >
            Download Video File ↓
          </a>
        </div>
      )}
    </div>
  );
};

// Add this component to your file
const DiagnosticTool: React.FC<{ videoBlob: Blob | null }> = ({ videoBlob }) => {
  const [diagnosticInfo, setDiagnosticInfo] = useState<string | null>(null);
  
  const runDiagnostics = async () => {
    if (!videoBlob) {
      setDiagnosticInfo("No video blob available");
      return;
    }
    
    try {
      setDiagnosticInfo("Running diagnostics...");
      
      // Check blob size
      const sizeMB = videoBlob.size / (1024 * 1024);
      let info = `Video size: ${sizeMB.toFixed(2)} MB\n`;
      
      // Check MIME type
      info += `MIME type: ${videoBlob.type}\n`;
      
      // Check browser details
      const isChrome = navigator.userAgent.indexOf("Chrome") > -1;
      const isFirefox = navigator.userAgent.indexOf("Firefox") > -1;
      const isSafari = navigator.userAgent.indexOf("Safari") > -1 && !isChrome;
      
      info += `Browser: ${isChrome ? "Chrome" : isFirefox ? "Firefox" : isSafari ? "Safari" : "Other"}\n`;
      
      // Check codec support
      const supportedTypes = [
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=h264,opus',
        'video/mp4;codecs=h264,aac'
      ];
      
      info += "Codec support:\n";
      supportedTypes.forEach(type => {
        info += `- ${type}: ${MediaRecorder.isTypeSupported(type) ? "✓" : "✗"}\n`;
      });
      
      setDiagnosticInfo(info);
    } catch (err) {
      setDiagnosticInfo(`Diagnostic error: ${err}`);
    }
  };
  
  return (
    <div className="mt-4 p-3 bg-gray-100 rounded-lg">
      <button 
        onClick={runDiagnostics}
        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Run Video Diagnostics
      </button>
      
      {diagnosticInfo && (
        <pre className="mt-2 text-xs whitespace-pre-wrap">
          {diagnosticInfo}
        </pre>
      )}
    </div>
  );
};

export default VideoRecorder; 
