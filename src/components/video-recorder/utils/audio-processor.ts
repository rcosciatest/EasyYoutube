/**
 * Utility for handling audio streams in recordings
 */

// Ensure audio tracks from source streams are properly added to target stream
export const ensureAudioTracks = (sourceStream: MediaStream, targetStream: MediaStream): boolean => {
  if (!sourceStream || !targetStream) {
    console.warn("Cannot ensure audio tracks - missing streams");
    return false;
  }
  
  const sourceAudioTracks = sourceStream.getAudioTracks();
  if (sourceAudioTracks.length === 0) {
    console.warn("Source stream has no audio tracks to add");
    return false;
  }
  
  // Get existing audio track IDs in target
  const existingTrackIds = targetStream.getAudioTracks().map(track => track.id);
  
  // Add each track from source that isn't already in target
  let tracksAdded = 0;
  sourceAudioTracks.forEach(track => {
    if (!existingTrackIds.includes(track.id)) {
      targetStream.addTrack(track);
      tracksAdded++;
    }
  });
  
  console.log(`Added ${tracksAdded} audio tracks from source to target stream`);
  return tracksAdded > 0;
};

// Manage audio levels for recording
export const setupAudioMonitoring = (stream: MediaStream | null): (() => void) => {
  if (!stream) return () => {};
  
  // Check for audio tracks
  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) {
    console.warn("No audio tracks found for monitoring");
    return () => {};
  }
  
  // Set up audio context and analyzer
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const analyzer = audioContext.createAnalyser();
  const microphone = audioContext.createMediaStreamSource(stream);
  microphone.connect(analyzer);
  
  // Configure analyzer
  analyzer.fftSize = 256;
  const bufferLength = analyzer.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  // Start monitoring
  let isRunning = true;
  const checkAudioLevels = () => {
    if (!isRunning) return;
    
    analyzer.getByteFrequencyData(dataArray);
    
    // Calculate volume level (0-100)
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    const average = sum / bufferLength;
    const volumeLevel = Math.min(100, Math.round((average / 255) * 100));
    
    // Log every second for debugging
    if (Date.now() % 1000 < 50) {
      console.log(`Audio level: ${volumeLevel}%`);
    }
    
    requestAnimationFrame(checkAudioLevels);
  };
  
  checkAudioLevels();
  
  // Return cleanup function
  return () => {
    isRunning = false;
    microphone.disconnect();
    audioContext.close();
  };
}; 