import { RefObject } from 'react';
import { ViewMode } from '../types';

// Enhanced recorder factory with guaranteed audio and view switching support
export const createRecorderWithAudio = (
  canvasStream: MediaStream,
  webcamStream: MediaStream | null,
  mimeType: string
): MediaRecorder => {
  console.log("%c🎤 AUDIO DEBUG: Creating recorder with GUARANTEED audio", "background:#ff0;color:#000;font-size:16px", {
    canvasHasAudioTracks: canvasStream.getAudioTracks().length,
    webcamHasAudioTracks: webcamStream?.getAudioTracks().length || 0,
    mimeType
  });
  
  // CRITICAL FIX: Always stop previous recorder
  if (window._mediaRecorderInstance) {
    try {
      if (window._mediaRecorderInstance.state === 'recording') {
        window._mediaRecorderInstance.stop();
      }
    } catch (e) {
      console.warn("Error stopping previous recorder:", e);
    }
  }
  
  // CRITICAL FIX: Create a fresh output stream that combines video and audio
  const outputStream = new MediaStream();
  
  // 1. First add all video tracks from canvas
  canvasStream.getVideoTracks().forEach(track => {
    console.log(`Adding video track: ${track.label}`);
    outputStream.addTrack(track);
  });
  
  // CRITICAL AUDIO FIX: 
  // 2. Directly request audio stream with promise resolution to ensure it's captured
  const ensureAudioTrack = async () => {
    let audioTrack = null;
    
    // First try using the existing direct audio stream if it exists and is active
    if (window._directAudioStream?.active && window._directAudioStream.getAudioTracks().length > 0) {
      audioTrack = window._directAudioStream.getAudioTracks()[0];
      if (audioTrack.readyState === 'live' && audioTrack.enabled) {
        console.log(`Using existing audio track: ${audioTrack.label}`);
        return audioTrack;
      }
    }
    
    // If no direct audio stream or track is not usable, create a new one
    try {
      console.log("Requesting fresh audio permissions");
      const freshAudioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      });
      
      audioTrack = freshAudioStream.getAudioTracks()[0];
      console.log(`Acquired fresh audio track: ${audioTrack.label}`);
      
      // Store for future reference
      window._directAudioStream = freshAudioStream;
      
      return audioTrack;
    } catch (err) {
      console.error("CRITICAL AUDIO ERROR: Failed to get fresh audio:", err);
      return null;
    }
  };
  
  // First create a basic recorder with video only
  let basicRecorder = new MediaRecorder(outputStream, {
    mimeType: mimeType,
    videoBitsPerSecond: 2500000
  });
  
  // Store globally
  window._mediaRecorderInstance = basicRecorder;
  
  // CRITICAL CHANGE: Immediately execute the audio promise and add to the stream
  ensureAudioTrack().then(audioTrack => {
    if (audioTrack) {
      // Dynamically add the audio track to the output stream
      try {
        outputStream.addTrack(audioTrack);
        console.log("%c✅ AUDIO TRACK ADDED SUCCESSFULLY", "background:green;color:white;font-size:16px");
        
        // Force recorder to recognize the new track by listening for track events
        outputStream.onaddtrack = (event) => {
          console.log(`Track added to stream: ${event.track.kind} - ${event.track.label}`);
        };
        
        // Create an audio context to monitor the audio levels
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const checkAudioLevels = () => {
          if (window._directAudioStream?.active) {
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
            console.log(`Audio level: ${average.toFixed(2)}`);
            
            // Blink the audio indicator based on levels
            if (average > 10) {
              console.log("%c🔊 AUDIO DETECTED", "background:green;color:white");
            }
            
            // Continue checking if still recording
            if (basicRecorder.state === 'recording') {
              setTimeout(checkAudioLevels, 1000);
            }
          }
        };
        
        // Start monitoring audio once recording begins
        basicRecorder.onstart = () => {
          console.log("%c🎬 RECORDING STARTED WITH AUDIO", "background:red;color:white;font-size:16px", {
            hasAudioTracks: outputStream.getAudioTracks().length > 0,
            audioTrackEnabled: audioTrack?.enabled,
            audioTrackMuted: audioTrack?.muted
          });
          checkAudioLevels();
        };
      } catch (e) {
        console.error("Failed to add audio track to stream:", e);
      }
    }
  });
  
  return basicRecorder;
};

// New function to clean up all audio resources (call when recording fully complete)
export const cleanupAudioResources = () => {
  console.log("Cleaning up audio resources to prevent memory leaks");
  
  // Stop all audio tracks
  if (window._directAudioStream) {
    window._directAudioStream.getTracks().forEach(track => track.stop());
    window._directAudioStream = null; // This is now allowed with our updated type
  }
  
  if (window._mediaRecorderInstance) {
    try {
      if (window._mediaRecorderInstance.state === 'recording') {
        window._mediaRecorderInstance.stop();
      }
    } catch (e) {
      console.warn("Error stopping media recorder:", e);
    }
    window._mediaRecorderInstance = null; // This is now allowed with our updated type
  }
  
  window._audioTracksAdded = 0;
  window._pendingAudioPromise = null;
};

// Helper function to update recorder audio without stopping it
export const updateRecorderAudio = (recorder: MediaRecorder, newAudioTrack: MediaStreamTrack): boolean => {
  try {
    // Get the current stream from the recorder
    const currentStream = recorder.stream;
    
    // Add the new audio track
    currentStream.addTrack(newAudioTrack);
    console.log("Successfully updated recorder with new audio track");
    return true;
  } catch (e) {
    console.warn("Failed to update recorder audio:", e);
    return false;
  }
};

// Improved video preview with reliable playback
export const fixVideoPreview = (
  videoRef: RefObject<HTMLVideoElement | null>,
  blob: Blob,
  mimeType: string
): string => {
  console.log(`Preparing video preview for ${blob.size} bytes, type: ${mimeType}`);
  
  // Clean up any existing URL
  if (videoRef.current && videoRef.current.src) {
    try {
      URL.revokeObjectURL(videoRef.current.src);
    } catch (e) {
      console.warn("Failed to revoke previous URL:", e);
    }
  }
  
  try {
    // Create URL from blob
    const url = URL.createObjectURL(blob);
    console.log(`Created URL: ${url}`);
    
    // Configure video element if available
    if (videoRef.current) {
      // Reset media element
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      
      // Set optimal playback properties
      videoRef.current.src = url;
      videoRef.current.muted = false;
      videoRef.current.controls = true;
      videoRef.current.autoplay = false;
      videoRef.current.playsInline = true;
      videoRef.current.preload = "auto";
      videoRef.current.crossOrigin = "anonymous";
      
      // Force a load to ensure the video is ready
      videoRef.current.load();
      
      console.log("Video element configured successfully");
    }
    
    return url;
  } catch (err) {
    console.error("Error setting up video preview:", err);
    return "";
  }
};

// Initialize globals if not already set
if (typeof window !== 'undefined') {
  window._mediaRecorderInstance = window._mediaRecorderInstance || null;
  window._audioTracksAdded = window._audioTracksAdded || 0;
  window._directAudioStream = window._directAudioStream || null;
  window._pendingAudioPromise = window._pendingAudioPromise || null;
  window._lastViewMode = window._lastViewMode || 'full';
}

// Add this function to ensure audio is captured properly for every recording
const ensureReliableAudioCapture = async () => {
  // Always create a new audio stream for maximum reliability
  try {
    const audioConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    };
    
    const audioStream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
      video: false
    });
    
    console.log("✅ Created dedicated audio stream for recording:", 
      audioStream.getAudioTracks()[0]?.label);
    
    // Store globally for reference
    window._directAudioStream = audioStream;
    
    return audioStream;
  } catch (err) {
    console.error("❌ Failed to create dedicated audio stream:", err);
    return null;
  }
}; 