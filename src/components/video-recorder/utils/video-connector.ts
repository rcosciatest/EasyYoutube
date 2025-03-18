/**
 * Utility for connecting media streams to video elements
 */

/**
 * Connect a MediaStream to a video element and ensure it loads properly
 * Returns a promise that resolves when the video is successfully connected
 */
export const connectStreamToVideo = (
  videoElement: HTMLVideoElement | null,
  stream: MediaStream | null,
  streamName: string = 'Stream'
): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!videoElement) {
      console.warn(`${streamName}: Video element is null`);
      resolve(false);
      return;
    }

    if (!stream) {
      console.warn(`${streamName}: Stream is null`);
      resolve(false);
      return;
    }

    // For debugging - log track info
    console.log(`${streamName} tracks:`, {
      video: stream.getVideoTracks().length,
      audio: stream.getAudioTracks().length
    });

    // Set up event handlers
    const onLoadedMetadata = () => {
      console.log(`${streamName}: Video metadata loaded`);
      
      // Start playback immediately
      videoElement.play()
        .then(() => {
          console.log(`${streamName}: Playback started`);
          resolve(true);
        })
        .catch(err => {
          console.error(`${streamName}: Playback failed`, err);
          resolve(false);
        });
    };

    const onError = (err: any) => {
      console.error(`${streamName}: Video element error`, err);
      resolve(false);
    };

    // Add event listeners
    videoElement.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
    videoElement.addEventListener('error', onError, { once: true });

    // Connect the stream
    videoElement.srcObject = stream;
    
    // Handle already loaded media
    if (videoElement.readyState >= 2) {
      console.log(`${streamName}: Video already has metadata`);
      videoElement.play()
        .then(() => resolve(true))
        .catch(() => resolve(false));
    }
    
    // Set timeout for slow connections
    setTimeout(() => {
      if (videoElement.readyState < 2) {
        console.warn(`${streamName}: Timeout waiting for video to load`);
        resolve(false);
      }
    }, 5000);
  });
}; 