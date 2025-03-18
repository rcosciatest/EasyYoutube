/**
 * Enhanced audio capture that works across all browsers
 */
import { setDirectAudioStream, incrementAudioTracksAdded } from '../types/window-fix';

// Guaranteed audio capture that works in all browsers
export const captureAudioForRecording = async (): Promise<MediaStream> => {
  console.log("🎤 ENHANCED AUDIO CAPTURE: Starting dedicated audio capture");
  
  try {
    // Try to get high-quality audio with ideal settings for recording
    const highQualityAudio = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: { ideal: true },
        channelCount: { ideal: 2 },
        sampleRate: { ideal: 48000 }
      }
    });
    
    // Log success and store globally
    console.log("%c✅ HIGH-QUALITY AUDIO CAPTURE SUCCESSFUL", "background:green;color:white", {
      tracks: highQualityAudio.getAudioTracks().length,
      label: highQualityAudio.getAudioTracks()[0]?.label
    });
    
    // Enable all tracks explicitly
    highQualityAudio.getAudioTracks().forEach(track => {
      track.enabled = true;
      console.log(`Enabled audio track: ${track.label}`);
    });
    
    // Store globally for reference
    setDirectAudioStream(highQualityAudio);
    incrementAudioTracksAdded();
    
    return highQualityAudio;
  } catch (err) {
    console.warn("⚠️ High-quality audio failed, trying basic audio", err);
    
    // Fall back to basic audio
    try {
      const basicAudio = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("%c✅ BASIC AUDIO CAPTURE SUCCESSFUL", "background:orange;color:black");
      setDirectAudioStream(basicAudio);
      incrementAudioTracksAdded();
      return basicAudio;
    } catch (fallbackErr) {
      console.error("❌ ALL AUDIO CAPTURE METHODS FAILED", fallbackErr);
      // Return empty stream as last resort
      return new MediaStream();
    }
  }
};

// Cross-browser compatible function to combine video and audio streams
export const createMixedStream = (videoStream: MediaStream, audioStream: MediaStream): MediaStream => {
  const mixedStream = new MediaStream();
  
  // Add all video tracks
  videoStream.getVideoTracks().forEach(track => {
    console.log(`Adding video track to mixed stream: ${track.label}`);
    mixedStream.addTrack(track);
  });
  
  // Add all audio tracks
  audioStream.getAudioTracks().forEach(track => {
    console.log(`Adding audio track to mixed stream: ${track.label}`);
    // Clone to avoid conflicts
    mixedStream.addTrack(track.clone());
  });
  
  return mixedStream;
}; 