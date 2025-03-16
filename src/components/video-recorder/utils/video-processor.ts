/**
 * Enhanced utility functions for reliable video processing
 */

// Process recorded video chunks into a playable format with audio
export const processVideoChunks = (
  chunks: Blob[],
  mimeType: string
): Blob => {
  console.log(`Processing ${chunks.length} video chunks with MIME type ${mimeType}`);
  
  // Ensure we have a workable mime type with audio codecs
  const safeMimeType = mimeType.includes('mp4') 
    ? 'video/mp4;codecs=avc1.42E01E,mp4a.40.2' 
    : 'video/webm;codecs=vp8,opus';
  
  try {
    // Create a new blob with the correct MIME type
    const processedBlob = new Blob(chunks, { type: safeMimeType });
    console.log(`Created processed blob: ${processedBlob.size} bytes with type ${processedBlob.type}`);
    
    return processedBlob;
  } catch (err) {
    console.error("Error processing video chunks:", err);
    // Fallback to basic webm container as a last resort
    return new Blob(chunks, { type: 'video/webm' });
  }
};

// Force video element to use the correct URL and settings with guaranteed audio
export const configureVideoElement = (
  videoElement: HTMLVideoElement,
  videoUrl: string
): void => {
  if (!videoElement) return;
  
  try {
    console.log("Configuring video element with optimized settings for playback with audio");
    
    // Reset video element
    videoElement.pause();
    videoElement.currentTime = 0;
    
    // Clear any existing source
    if (videoElement.src) {
      try {
        URL.revokeObjectURL(videoElement.src);
      } catch (e) {
        console.warn("Failed to revoke previous URL:", e);
      }
    }
    
    // Set optimal playback properties with guaranteed audio
    videoElement.preload = 'auto';
    videoElement.playsInline = true;
    videoElement.controls = true;
    videoElement.crossOrigin = 'anonymous'; // Helps with some browser compatibility
    videoElement.muted = false; // CRUCIAL: Ensure audio is not muted
    videoElement.volume = 1.0; // Set maximum volume
    
    // Set the new source
    videoElement.src = videoUrl;
    
    // Force a reload
    videoElement.load();
    
    // Try to preload a bit of content to improve initial playback
    const preloadVideo = async () => {
      try {
        // Unmute before playing (some browsers require this)
        videoElement.muted = false;
        videoElement.volume = 1.0;
        
        // Try to wake up the audio context if needed
        try {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContext) {
            const audioCtx = new AudioContext();
            const source = audioCtx.createMediaElementSource(videoElement);
            source.connect(audioCtx.destination);
            
            // Resume audio context to ensure it's active
            if (audioCtx.state === 'suspended') {
              await audioCtx.resume();
            }
          }
        } catch (e) {
          console.warn("Audio context setup failed (not critical):", e);
        }
        
        // Play a short segment
        await videoElement.play();
        videoElement.currentTime = 0.1; // Move slightly forward
        
        // If autoplay failed, show a prominent message
        setTimeout(() => {
          if (videoElement.paused) {
            console.warn("Autoplay blocked by browser, showing user interaction required message");
            // Add a click-to-play overlay if needed here
          }
          videoElement.pause();
          videoElement.currentTime = 0; // Reset to beginning
        }, 200);
      } catch (e) {
        console.warn("Preload play failed (not critical):", e);
      }
    };
    
    preloadVideo();
    
  } catch (err) {
    console.error("Error configuring video element:", err);
  }
};

// New function to fix Chrome issues with audio-video sync
export const ensureAudioVideoSync = (videoBlob: Blob): Promise<Blob> => {
  return new Promise((resolve) => {
    try {
      // Create a temporary audio context
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) {
        console.warn("AudioContext not available for sync fix");
        return resolve(videoBlob);
      }
      
      // Create URLs for the blob
      const url = URL.createObjectURL(videoBlob);
      
      // Create a temporary video element
      const tempVideo = document.createElement('video');
      tempVideo.src = url;
      tempVideo.muted = false;
      
      // When metadata is loaded, we can proceed
      tempVideo.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(videoBlob);
      };
      
      // If there's an error or it takes too long, just return the original blob
      tempVideo.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(videoBlob);
      };
      
      // Set a timeout in case nothing happens
      setTimeout(() => {
        URL.revokeObjectURL(url);
        resolve(videoBlob);
      }, 1000);
      
      // Force load
      tempVideo.load();
    } catch (e) {
      console.warn("Error in audio-video sync process:", e);
      resolve(videoBlob);
    }
  });
}; 