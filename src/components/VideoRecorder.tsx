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
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Get supported MIME type
  const getSupportedMimeType = () => {
    const types = [
      'video/webm;codecs=vp9,opus',
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
          video: { width: 1280, height: 720 },
          audio: true 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        
        streamRef.current = stream;
        setCameraPermission(true);
        
        // Create MediaRecorder with proper MIME type
        const recorder = new MediaRecorder(stream, {
          mimeType: getSupportedMimeType(),
          videoBitsPerSecond: 2500000 // 2.5 Mbps
        });
        
        recorder.ondataavailable = (event) => {
          console.log('Data available event fired, data size:', event.data.size);
          if (event.data && event.data.size > 0) {
            chunksRef.current.push(event.data);
            setRecordedChunks(prev => [...prev, event.data]);
          }
        };
        
        mediaRecorderRef.current = recorder;
      } catch (err) {
        console.error('Error initializing camera:', err);
        setError('Could not access camera: ' + (err instanceof Error ? err.message : String(err)));
        setCameraPermission(false);
      }
    };
    
    initCamera();
    
    return () => {
      // Clean up on component unmount
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  // Start recording function
  const startRecording = () => {
    if (!streamRef.current) return;
    
    try {
      // Only reset chunks at the beginning of a new recording, not when resuming
      if (recordingState !== 'paused') {
        chunksRef.current = [];
        setRecordedChunks([]);
        setVideoUrl(null);
        setVideoBlob(null);
      }
      
      if (!mediaRecorderRef.current) {
        console.error('MediaRecorder not initialized');
        setError('Recording device not initialized properly');
        return;
      }
      
      if (mediaRecorderRef.current.state === 'inactive') {
        // Starting a new recording
        console.log('Starting new recording');
        mediaRecorderRef.current.start(1000); // Collect data every second
      } else if (mediaRecorderRef.current.state === 'paused') {
        // Resuming paused recording
        console.log('Resuming paused recording');
        mediaRecorderRef.current.resume();
      }
      
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
  const stopRecording = () => {
    if (!mediaRecorderRef.current || recordingState === 'idle') return;
    
    try {
      // Request final data segment before stopping
      if (mediaRecorderRef.current.state !== 'inactive') {
        // Use requestData to ensure the final chunk is captured
        if (typeof mediaRecorderRef.current.requestData === 'function') {
          try {
            mediaRecorderRef.current.requestData();
          } catch (e) {
            console.log('requestData not supported or failed:', e);
          }
        }
        
        // Stop the recording
        mediaRecorderRef.current.stop();
        console.log('Recording stopped, chunks collected:', chunksRef.current.length);
        
        // Use setTimeout to ensure all data is processed before creating the blob
        setTimeout(() => {
          if (chunksRef.current.length > 0) {
            const blob = new Blob(chunksRef.current, { 
              type: mediaRecorderRef.current?.mimeType || 'video/webm' 
            });
            
            console.log('Video blob created:', blob.size, 'bytes');
            
            if (blob.size > 0) {
              const url = URL.createObjectURL(blob);
              setVideoUrl(url);
              setVideoBlob(blob);
            } else {
              setError('Created video is empty. Please try recording again.');
            }
          } else {
            setError('No video data was captured. Please try recording again.');
          }
        }, 500); // Give browser time to process all chunks
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
        <div className="w-full md:w-2/3">
          <div className="bg-gray-800 rounded-lg relative overflow-hidden">
            <video 
              ref={videoRef}
              autoPlay 
              muted 
              playsInline
              className="w-full h-auto"
            />
            
            {showTeleprompter && recordingState !== 'idle' && (
              <Teleprompter 
                script={script} 
                position={teleprompterPosition}
                onClose={() => setShowTeleprompter(false)}
              />
            )}
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
          
          {downloadStatus && (
            <div className="mt-2 text-sm text-gray-700">
              {downloadStatus}
            </div>
          )}
        </div>
        
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
export const MediaPlayer: React.FC<MediaPlayerProps> = ({ videoUrl, onError }) => {
  if (!videoUrl) return null;
  
  return (
    <div className="mt-4">
      <video
        controls
        src={videoUrl}
        className="w-full rounded-lg shadow-lg"
        onError={() => onError?.('Error playing the recorded video')}
      />
    </div>
  );
};

export default VideoRecorder; 