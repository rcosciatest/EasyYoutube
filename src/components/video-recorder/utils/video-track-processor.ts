/**
 * Utility for managing video tracks and ensuring stream consistency
 */
import { RecorderTelemetry } from './telemetry';

export const videoTrackProcessor = {
  /**
   * Pulse a stream's video track to force an update
   * Similar to forceTrackUpdate but with different strategy
   */
  pulseTrack: (stream: MediaStream | null): void => {
    if (!stream) {
      console.warn('Cannot pulse track: Stream is null');
      return;
    }
    
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) {
      console.warn('No video tracks to pulse');
      return;
    }
    
    const track = videoTracks[0];
    
    // Log original track state
    const originalEnabled = track.enabled;
    
    RecorderTelemetry.recordEvent('pulseTrack', { 
      trackLabel: track.label,
      originalState: originalEnabled 
    });
    
    // Pulse the track to force a refresh
    track.enabled = false;
    
    // Re-enable after a small delay
    setTimeout(() => {
      track.enabled = originalEnabled;
      
      RecorderTelemetry.recordEvent('pulseTrackComplete', { 
        trackLabel: track.label,
        finalState: track.enabled 
      });
    }, 20);
  },
  
  /**
   * Force update on a media stream's video track to refresh the stream
   * This can help resolve issues with frozen frames or track state
   */
  forceTrackUpdate: (stream: MediaStream | null): void => {
    if (!stream) {
      console.warn('Cannot force track update: Stream is null');
      return;
    }
    
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) {
      console.warn('No video tracks to update');
      return;
    }
    
    RecorderTelemetry.recordEvent('forceTrackUpdate', { 
      trackCount: videoTracks.length,
      trackLabels: videoTracks.map(t => t.label)
    });
    
    try {
      // Read track constraints before replacing
      const track = videoTracks[0];
      const trackSettings = track.getSettings();
      
      // Apply a tiny constraint change to force a refresh
      track.applyConstraints({
        ...trackSettings,
        width: (trackSettings.width || 1280) + 1
      })
      .then(() => {
        // Then immediately revert to original
        return track.applyConstraints(trackSettings);
      })
      .then(() => {
        RecorderTelemetry.recordEvent('forceTrackUpdateComplete', { 
          success: true
        });
      })
      .catch(err => {
        // If constraints fail, try the pulse method instead
        console.warn('Constraints update failed, falling back to pulse method:', err);
        videoTrackProcessor.pulseTrack(stream);
        
        RecorderTelemetry.recordEvent('forceTrackUpdateError', { 
          error: String(err)
        });
      });
    } catch (err) {
      console.error('Error during track update:', err);
      RecorderTelemetry.recordEvent('forceTrackUpdateFailed', { 
        error: String(err)
      });
    }
  },
  
  /**
   * Diagnose track health and provide status information
   */
  getTracksStatus: (stream: MediaStream | null): {
    healthy: boolean;
    videoTracks: number;
    audioTracks: number;
    muted: boolean;
    details: string[];
  } => {
    if (!stream) {
      return { 
        healthy: false, 
        videoTracks: 0, 
        audioTracks: 0, 
        muted: true,
        details: ['No stream available'] 
      };
    }
    
    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();
    const details: string[] = [];
    
    // Check video tracks
    let videoHealthy = true;
    videoTracks.forEach((track, index) => {
      if (!track.enabled) {
        videoHealthy = false;
        details.push(`Video track ${index} is disabled`);
      }
      
      if (track.muted) {
        videoHealthy = false;
        details.push(`Video track ${index} is muted`);
      }
      
      details.push(`Video ${index}: ${track.label} (${track.readyState})`);
    });
    
    // Check audio tracks
    let audioHealthy = true;
    let allMuted = audioTracks.length > 0;
    
    audioTracks.forEach((track, index) => {
      if (!track.enabled) {
        audioHealthy = false;
        details.push(`Audio track ${index} is disabled`);
      }
      
      if (!track.muted) {
        allMuted = false;
      }
      
      details.push(`Audio ${index}: ${track.label} (${track.readyState})`);
    });
    
    return {
      healthy: videoHealthy && audioHealthy && videoTracks.length > 0,
      videoTracks: videoTracks.length,
      audioTracks: audioTracks.length,
      muted: allMuted,
      details
    };
  }
}; 