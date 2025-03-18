/**
 * Audio utilities to ensure proper audio handling in recordings
 */
import { RefObject } from 'react';

/**
 * Ensure that audio tracks from source stream are added to target stream
 * This is necessary because canvas streams don't include audio by default
 */
export const ensureAudioTracks = (
  sourceStream: MediaStream | null, 
  targetStream: MediaStream
): boolean => {
  if (!sourceStream) {
    console.warn('No source stream to get audio tracks from');
    return false;
  }
  
  if (!targetStream) {
    console.warn('No target stream to add audio tracks to');
    return false;
  }
  
  // Get audio tracks from source
  const audioTracks = sourceStream.getAudioTracks();
  if (audioTracks.length === 0) {
    console.warn('Source stream has no audio tracks');
    return false;
  }
  
  // Check if target already has these tracks
  const existingAudioTracks = targetStream.getAudioTracks();
  const existingTrackIds = existingAudioTracks.map(track => track.id);
  
  // Add each audio track if it's not already in the target stream
  let tracksAdded = 0;
  audioTracks.forEach(track => {
    if (!existingTrackIds.includes(track.id)) {
      targetStream.addTrack(track);
      tracksAdded++;
    }
  });
  
  console.log(`Audio tracks: ${tracksAdded} added, ${existingAudioTracks.length} existing`);
  
  return tracksAdded > 0 || existingAudioTracks.length > 0;
};

/**
 * Create an optimized audio stream for recording
 * Uses noise suppression and echo cancellation when available
 */
export const createOptimizedAudioStream = async (): Promise<MediaStream | null> => {
  try {
    // Request audio with optimal constraints for recording
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 2
      }
    });
    
    // Verify we got audio tracks
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.warn('No audio tracks obtained from optimized constraints');
      return null;
    }
    
    console.log('Created optimized audio stream:', 
      audioTracks[0].getSettings());
      
    return stream;
  } catch (err) {
    console.error('Failed to create optimized audio stream:', err);
    return null;
  }
}; 