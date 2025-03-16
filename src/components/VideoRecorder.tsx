import React, { useState, useRef, useEffect } from 'react';
import Teleprompter from './Teleprompter';
import { downloadVideo as downloadVideoUtil } from '../utils/download_utils';
import { initializeVideoRecorder } from './video-recorder/utils/initialize';

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
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
      console.log("Starting recording...");
      
      // Reset state
      chunksRef.current = [];
      setRecordedChunks([]);
      setError(null);
      setRecordingDuration(0);
      setVideoUrl(null);
      setVideoBlob(null);
      
      // Ensure streams are connected
      await ensureVideoStreamsAvailable();
      
      // Wait for streams to stabilize
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Create fresh recording stream
      const finalStream = getFinalStream();
      setCanvasStream(finalStream);
      
      // Get supported format
      const mimeType = getSupportedMimeType();
      console.log(`Using recording format: ${mimeType} for ${viewMode} mode`);
      
      // Create recorder with better settings
      const recorder = new MediaRecorder(finalStream, {
        mimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      });
      
      mediaRecorderRef.current = recorder;
      
      // Handle data chunks
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          console.log(`Received data chunk: ${(event.data.size / 1024).toFixed(1)}KB`);
          chunksRef.current.push(event.data);
        } else {
          console.warn("Empty data chunk received");
        }
      };
      
      // Handle recording completion
      recorder.onstop = () => {
        console.log(`Recording stopped with ${chunksRef.current.length} chunks`);
        
        // Stop animation frame
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
        
        // Clear old URL
        if (videoUrl) {
          URL.revokeObjectURL(videoUrl);
        }
        
        // Check for data
        if (chunksRef.current.length === 0) {
          console.error("No data recorded");
          setError('No video data was captured. Please try again.');
          setRecordingState('idle');
          return;
        }
        
        try {
          // Create blob from all chunks
          const blob = new Blob(chunksRef.current, { type: mimeType });
          console.log(`Created video blob: ${(blob.size / (1024 * 1024)).toFixed(2)}MB`);
          
          // Set state with blob and chunks
          setVideoBlob(blob);
          setRecordedChunks([...chunksRef.current] as Blob[]);
          
          // Create URL for playback
          const url = URL.createObjectURL(blob);
          setVideoUrl(url);
          console.log(`Video URL created: ${url}`);
        } catch (e) {
          console.error('Error creating video blob:', e);
          setError(`Failed to process recording: ${e}`);
        }
        
        setRecordingState('idle');
      };
      
      // Start with small chunks for responsive view switching
      recorder.start(100);
      
      // Start timer
      startTimer();
      
      console.log("Recording started successfully");
      setRecordingState('recording');
    } catch (err) {
      console.error('Error starting recording:', err);
      setError(`Recording failed: ${String(err)}`);
      setRecordingState('idle');
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
    console.log("Stopping recording...");
    
    if (mediaRecorderRef.current && recordingState === 'recording') {
      try {
        // Stop the recorder
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
        
        // Stop the timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        
        // Reset canvas stream if needed
        if (canvasStream) {
          canvasStream.getTracks().forEach(track => track.stop());
          setCanvasStream(null);
        }
        
        console.log("Recording stopped gracefully");
      } catch (err) {
        console.error("Error stopping recording:", err);
        setError(`Failed to stop recording: ${err}`);
      }
    } else {
      console.warn("No active recording to stop");
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
      screenVideoRef.current.play().catch(e => console.error("Error playing restored screen video:", e));
    }
  };
  
  // Update toggleViewMode to call this function
  const toggleViewMode = async (mode: 'full' | 'split') => {
    console.log(`Toggling view mode: ${viewMode} → ${mode}`);
    
    // Set view mode immediately for UI feedback
    setViewMode(mode);
    
    if (mode === 'split') {
      if (!screenStream || !screenStream.active) {
        // Need to start screen capture
        const stream = await startScreenCapture();
        if (!stream) {
          console.error("Screen capture failed - reverting to full view");
          setViewMode('full');
          return; // Exit early if screen capture fails
        }
      }
    }
    
    // Add a small delay to allow DOM updates before checking streams
    setTimeout(() => {
      ensureVideoStreamsAvailable();
      // Force a redraw of the canvas if we're recording
      if (recordingState === 'recording' && animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = requestAnimationFrame(drawToCanvas);
      }
    }, 200);
  };
  
  // Add this improved function to ensure video streams are properly connected
  const ensureVideoStreamsAvailable = () => {
    const webcamStream = streamRef.current;
    console.log("Ensuring video streams for mode:", viewMode);
    
    if (webcamStream) {
      // For full view, ensure main video has webcam stream
      if (viewMode === 'full' && videoRef.current) {
        if (!videoRef.current.srcObject || videoRef.current.srcObject !== webcamStream) {
          console.log("Restoring main webcam stream");
          videoRef.current.srcObject = webcamStream;
          videoRef.current.play().catch(e => console.error("Error playing restored main webcam:", e));
        }
      }
      
      // For split view, ensure circle/square video has webcam stream
      if (viewMode === 'split' && circleWebcamRef.current) {
        if (!circleWebcamRef.current.srcObject || circleWebcamRef.current.srcObject !== webcamStream) {
          console.log("Restoring circle webcam stream");
          circleWebcamRef.current.srcObject = webcamStream;
          circleWebcamRef.current.play().catch(e => console.error("Error playing restored circle webcam:", e));
        }
      }
    } else {
      console.warn("No webcam stream available");
    }
    
    // For split view, check screen video
    if (viewMode === 'split' && screenStream && screenVideoRef.current) {
      if (!screenVideoRef.current.srcObject || screenVideoRef.current.srcObject !== screenStream) {
        console.log("Restoring screen capture stream");
        screenVideoRef.current.srcObject = screenStream;
        screenVideoRef.current.play().catch(e => console.error("Error playing restored screen video:", e));
      }
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
  }, [screenStream, toggleViewMode]);
  
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
    // Store a reference to the current URL
    const currentVideoUrl = videoUrl;
    
    return () => {
      if (currentVideoUrl) {
        URL.revokeObjectURL(currentVideoUrl);
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
  
  // Completely rewritten drawToCanvas function
  const drawToCanvas = () => {
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
      if (viewMode === 'full') {
        // Draw the webcam video full screen
        if (videoRef.current && videoRef.current.readyState >= 2) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        }
      } else if (viewMode === 'split') {
        // Draw screen capture background
        if (screenVideoRef.current && screenVideoRef.current.readyState >= 2) {
          ctx.drawImage(screenVideoRef.current, 0, 0, canvas.width, canvas.height);
        }
        
        // Draw webcam overlay
        if (circleWebcamRef.current && circleWebcamRef.current.readyState >= 2) {
          const size = Math.min(canvas.width, canvas.height) * 0.25;
          const x = canvas.width - size - 20;
          const y = canvas.height - size - 20;
          
          // Draw webcam with rounded corners
          ctx.save();
          ctx.beginPath();
          if (ctx.roundRect) {
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
          if (ctx.roundRect) {
            ctx.roundRect(x, y, size, size, 8);
          } else {
            ctx.rect(x, y, size, size);
          }
          ctx.stroke();
        }
      }
      
      // Add recording indicator and time
      if (recordingState === 'recording') {
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
  };

  // Now update getFinalStream to use the shared drawToCanvas function
  const getFinalStream = (): MediaStream => {
    // Make sure canvas exists
    if (!canvasRef.current) {
      console.log("Creating canvas in getFinalStream");
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 1280;
      canvasRef.current.height = 720;
    }
    
    // Stop any existing animation
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    
    // Start drawing to canvas
    drawToCanvas();
    
    // Create stream with consistent framerate
    const stream = canvasRef.current.captureStream(30);
    console.log(`Created stream with ${stream.getTracks().length} tracks`);
    
    // Add audio track if available from webcam
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        stream.addTrack(audioTracks[0]);
        console.log("Added audio track to recording stream");
      }
    }
    
    return stream;
  };
  
  // Add this helper function
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Fixed timer implementation
  const startTimer = () => {
    // Clear existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // Reset duration
    setRecordingDuration(0);
    
    // Record start time
    const startTime = Date.now();
    
    // Update every second
    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      setRecordingDuration(Math.floor(elapsed / 1000));
      console.log(`Recording time: ${Math.floor(elapsed / 1000)}s`);
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
  
  // Call initialization function before anything else
  useEffect(() => {
    initializeVideoRecorder();
  }, []);
  
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
  
  const onError = (message: string) => {
    console.error(`Media player error: ${message}`);
    setErrorDetails(message);
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
