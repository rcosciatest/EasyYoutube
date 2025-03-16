// Get supported MIME type for recording
export const getSupportedMimeType = (): string => {
  // List of container/codec combinations to try
  const mimeTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264,opus',
    'video/mp4;codecs=h264,aac',
    'video/webm',
    'video/mp4'
  ];
  
  // Find the first supported type that includes audio
  for (const type of mimeTypes) {
    if (MediaRecorder.isTypeSupported(type)) {
      console.log(`Browser supports mime type: ${type}`);
      return type;
    }
  }
  
  // Fallback to default WebM
  console.warn("No preferred MIME types supported by this browser, using default");
  return 'video/webm';
};

// Format seconds to MM:SS
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}; 