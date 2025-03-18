/**
 * Utility for reliably connecting and managing media streams
 */
import { connectStreamToVideo } from './video-connector';
import { RecorderTelemetry } from './telemetry';

export const streamConnector = {
  /**
   * Connect webcam stream to all webcam video elements
   */
  connectWebcamStream: async (
    webcamStream: MediaStream | null,
    mainVideoRef: React.RefObject<HTMLVideoElement>,
    circleVideoRef: React.RefObject<HTMLVideoElement>
  ): Promise<boolean> => {
    if (!webcamStream) {
      console.warn('No webcam stream to connect');
      return false;
    }
    
    RecorderTelemetry.recordEvent('connectWebcam', { 
      tracks: webcamStream.getTracks().length 
    });
    
    let success = true;
    
    // Connect to main webcam video
    const mainResult = await connectStreamToVideo(
      mainVideoRef.current, 
      webcamStream, 
      'Main webcam'
    );
    
    if (!mainResult) {
      success = false;
      console.error('Failed to connect main webcam video');
    }
    
    // Connect to circle webcam if available
    if (circleVideoRef.current) {
      const circleResult = await connectStreamToVideo(
        circleVideoRef.current,
        webcamStream,
        'Circle webcam'
      );
      
      if (!circleResult) {
        console.warn('Failed to connect circle webcam video');
        // Don't fail completely if just the circle overlay fails
      }
    }
    
    return success;
  },
  
  /**
   * Connect screen capture stream to video element
   */
  connectScreenStream: async (
    screenStream: MediaStream | null,
    screenVideoRef: React.RefObject<HTMLVideoElement>
  ): Promise<boolean> => {
    if (!screenStream) {
      console.warn('No screen stream to connect');
      return false;
    }
    
    RecorderTelemetry.recordEvent('connectScreen', { 
      tracks: screenStream.getTracks().length 
    });
    
    return await connectStreamToVideo(
      screenVideoRef.current,
      screenStream,
      'Screen capture'
    );
  }
};