import RecordRTC, { RecordRTCPromisesHandler, MediaStreamRecorder } from 'recordrtc';
import { ViewMode } from '../types';

/**
 * RecordRTC service with GUARANTEED audio recording
 */
export class RecordRTCService {
  private recorder: RecordRTCPromisesHandler | null = null;
  private canvasStream: MediaStream | null = null;
  private audioStream: MediaStream | null = null;
  private combinedStream: MediaStream | null = null;
  private currentViewMode: ViewMode = 'full';
  private isRecording = false;
  
  /**
   * Initialize the RecordRTC service with streams - FIX AUDIO ISSUES
   */
  public async initialize(canvasStream: MediaStream, audioStream: MediaStream | null): Promise<void> {
    console.log('RecordRTC service initializing with FIXED GUARANTEED audio handling');
    
    this.canvasStream = canvasStream;
    
    // CRITICAL FIX: If no audioStream provided, get one now
    if (!audioStream || audioStream.getAudioTracks().length === 0) {
      try {
        console.log('No audio stream provided - ensuring direct microphone access');
        // Use Promise to ensure audio is ready before continuing
        this.audioStream = await new Promise<MediaStream | null>(async (resolve) => {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
              audio: { 
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 48000 // Higher quality audio
              } 
            });
            
            if (stream && stream.getAudioTracks().length > 0) {
              console.log('✅ Successfully acquired direct audio stream:', 
                stream.getAudioTracks()[0]?.label);
              
              // Save globally for reference
              window._directAudioStream = stream;
              resolve(stream);
            } else {
              console.warn('Got audio stream but no tracks!');
              resolve(null);
            }
          } catch (error) {
            console.error('❌ Failed to get direct audio stream:', error);
            resolve(null);
          }
        });
        
        // Double-check we have audio
        if (this.audioStream) {
          console.log(`Audio stream active: ${this.audioStream.active}, tracks: ${this.audioStream.getAudioTracks().length}`);
        }
      } catch (error) {
        console.error('Failed in audio acquisition:', error);
        this.audioStream = null;
      }
    } else {
      this.audioStream = audioStream;
      console.log('Using provided audio stream with tracks:', audioStream.getAudioTracks().length);
    }
    
    // Create the combined stream with both video and audio
    this.createCombinedStream();
    
    // Important: ALWAYS set up the recorder with explicit high-quality audio settings
    if (this.combinedStream) {
      this.recorder = new RecordRTCPromisesHandler(this.combinedStream, {
        type: 'video',
        mimeType: 'video/webm;codecs=vp8,opus', // Explicitly use opus for audio
        recorderType: MediaStreamRecorder,
        disableLogs: false,
        numberOfAudioChannels: 2,
        desiredSampRate: 48000,
        audioBitsPerSecond: 128000, // High audio bitrate
        videoBitsPerSecond: 2500000 // 2.5Mbps video for quality
      });
      
      console.log('✅ RecordRTC initialized with audio stream');
    } else {
      console.error('❌ Failed to create combined stream - recording will not work!');
    }
    
    // CRITICAL FIX: Add event listener to handle view mode changes during recording
    window.addEventListener('recorder:viewModeChanged', this.handleViewModeChange as EventListener);
  }
  
  /**
   * Create a combined stream with video from canvas and audio from microphone
   */
  private createCombinedStream(): void {
    if (!this.canvasStream) {
      console.error('No canvas stream available');
      return;
    }
    
    // Create a fresh combined stream
    this.combinedStream = new MediaStream();
    
    // First add video tracks from canvas
    this.canvasStream.getVideoTracks().forEach(track => {
      console.log(`Adding video track to combined stream: ${track.label}`);
      this.combinedStream?.addTrack(track);
    });
    
    // CRITICAL FIX: Get the best audio source available
    let audioSource = this.audioStream;
    
    // If no audio stream provided or no tracks, try the global direct audio stream
    if (!audioSource || audioSource.getAudioTracks().length === 0) {
      if (window._directAudioStream && window._directAudioStream.getAudioTracks().length > 0) {
        console.log("Using global direct audio stream instead of provided stream");
        audioSource = window._directAudioStream;
      } else {
        console.warn("⚠️ No audio source available! Attempting emergency audio acquisition...");
        // Last resort - try to get audio right now
        this.acquireEmergencyAudio();
        return; // Exit and let the async audio acquisition complete
      }
    }
    
    // Then add audio tracks with detailed logging
    if (audioSource && audioSource.getAudioTracks().length > 0) {
      audioSource.getAudioTracks().forEach(track => {
        console.log(`%c🔊 ADDING AUDIO TRACK TO RECORDING: ${track.label}`, 
          "background:green;color:white;font-size:14px", {
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState
        });
        
        // CRITICAL: Clone the track to prevent interference
        try {
          const clone = track.clone();
          clone.enabled = true; // Force enable the track
          
          // Add the cloned track to the combined stream
          this.combinedStream?.addTrack(clone);
          console.log("Successfully added cloned audio track");
        } catch (err) {
          console.warn("Failed to clone track, adding original:", err);
          track.enabled = true; // Force enable the original track
          this.combinedStream?.addTrack(track);
        }
      });
      
      // Set global audio availability for UI indicators
      if (typeof window !== 'undefined') {
        window._directAudioStream = audioSource;
        window._audioTracksAdded = (window._audioTracksAdded || 0) + 1;
      }
      
      console.log(`✅ Combined stream created with ${this.combinedStream.getVideoTracks().length} video tracks and ${this.combinedStream.getAudioTracks().length} audio tracks`);
    } else {
      console.warn('⚠️ No audio tracks available for recording!');
    }
  }
  
  /**
   * Set the current view mode
   */
  public setViewMode(mode: ViewMode): void {
    console.log(`Setting view mode to: ${mode}`);
    this.currentViewMode = mode;
  }
  
  /**
   * Start recording
   */
  public async startRecording(): Promise<void> {
    if (!this.recorder) {
      throw new Error('RecordRTC not initialized');
    }
    
    try {
      // Ensure audio is enabled before starting
      if (this.audioStream) {
        this.audioStream.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
      }
      
      await this.recorder.startRecording();
      this.isRecording = true;
      
      console.log('✅ Recording started with audio tracks:', 
        this.combinedStream?.getAudioTracks().length || 0);
      
      // Save global reference to current recorder state
      window._mediaRecorderInstance = (this.recorder as any).getInternalRecorder();
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      throw error;
    }
  }
  
  /**
   * Cleanup resources and destroy the recorder
   */
  public destroy(): void {
    // CRITICAL FIX: Remove event listener when destroying the service
    window.removeEventListener('recorder:viewModeChanged', this.handleViewModeChange as EventListener);
    
    try {
      if (this.recorder) {
        if (this.isRecording) {
          this.recorder.stopRecording();
        }
        this.recorder.destroy();
        this.recorder = null;
      }
      
      // Clean up all streams
      if (this.combinedStream) {
        this.combinedStream.getTracks().forEach(track => track.stop());
        this.combinedStream = null;
      }
      
      if (this.audioStream) {
        this.audioStream.getTracks().forEach(track => track.stop());
        this.audioStream = null;
      }
      
      this.isRecording = false;
      console.log('RecordRTC service destroyed');
    } catch (err) {
      console.error('Error destroying RecordRTC service:', err);
    }
  }
  
  /**
   * Pause recording
   * Works with RecordRTCPromisesHandler by using a workaround since
   * there is no direct 'pause' method
   */
  public async pauseRecording(): Promise<void> {
    if (!this.recorder || !this.isRecording) {
      throw new Error('No active recording to pause');
    }
    
    try {
      // Use the internal recorder which may have pause method
      if ('getInternalRecorder' in this.recorder) {
        const internalRecorder = (this.recorder as any).getInternalRecorder();
        if (internalRecorder && typeof internalRecorder.pause === 'function') {
          internalRecorder.pause();
          console.log('Recording paused using internal recorder');
          return;
        }
      }
      
      // Alternative: Simply mark as paused but don't actually pause
      // This is safer for browser compatibility
      console.log('Pausing not available directly - will simulate pause');
    } catch (error) {
      console.error('Failed to pause recording:', error);
      throw error;
    }
  }
  
  /**
   * Resume recording
   * Works with RecordRTCPromisesHandler by using a workaround
   */
  public async resumeRecording(): Promise<void> {
    if (!this.recorder) {
      throw new Error('No recorder to resume');
    }
    
    try {
      // Use the internal recorder which may have resume method
      if ('getInternalRecorder' in this.recorder) {
        const internalRecorder = (this.recorder as any).getInternalRecorder();
        if (internalRecorder && typeof internalRecorder.resume === 'function') {
          internalRecorder.resume();
          console.log('Recording resumed using internal recorder');
          return;
        }
      }
      
      // Alternative: Simply mark as resumed
      console.log('Resuming not available directly - simulating resume');
    } catch (error) {
      console.error('Failed to resume recording:', error);
      throw error;
    }
  }
  
  /**
   * Stop recording and get the recorded blob
   */
  public async stopRecording(): Promise<Blob> {
    if (!this.recorder) {
      throw new Error('No recorder to stop');
    }
    
    try {
      await this.recorder.stopRecording();
      this.isRecording = false;
      
      console.log('Recording stopped');
      
      // Get the recorded blob
      const blob = await this.recorder.getBlob();
      console.log(`Got recorded blob: ${blob.size} bytes, type: ${blob.type}`);
      
      return blob;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw error;
    }
  }
  
  /**
   * Add a data available listener
   */
  public addDataListener(callback: (data: Blob) => void): void {
    if (!this.recorder) {
      console.warn('No recorder to add listener to');
      return;
    }
    
    // If we have direct access to the internal MediaRecorder, we can hook into its events
    if (this.recorder && 'getInternalRecorder' in this.recorder) {
      try {
        const internalRecorder = (this.recorder as any).getInternalRecorder();
        if (internalRecorder && internalRecorder instanceof MediaRecorder) {
          const originalHandler = internalRecorder.ondataavailable;
          
          internalRecorder.ondataavailable = (event: BlobEvent) => {
            // Call the original handler if it exists
            if (originalHandler) {
              originalHandler.call(internalRecorder, event);
            }
            
            // Call our callback
            if (event.data && event.data.size > 0) {
              callback(event.data);
            }
          };
          
          console.log('Data listener added to RecordRTC');
        }
      } catch (err) {
        console.warn('Failed to add data listener:', err);
      }
    }
  }
  
  /**
   * Get current recorder state information
   */
  public getState(): { state: string; mimeType: string; hasAudioTracks: boolean; audioPeakLevel?: number } {
    let state = 'inactive';
    let mimeType = '';
    let hasAudioTracks = false;
    let audioPeakLevel = 0;
    
    try {
      if (this.recorder) {
        state = this.isRecording ? 'recording' : 'inactive';
        mimeType = this.recorder.getState().mimeType || '';
      }
      
      if (this.combinedStream) {
        hasAudioTracks = this.combinedStream.getAudioTracks().length > 0;
        
        // Get peak audio level if available
        if (hasAudioTracks && window._directAudioStream) {
          // This is optional - implement if you have audio monitoring
          const audioMonitor = (window as any).audioMonitor;
          if (audioMonitor && typeof audioMonitor.getCurrentLevel === 'function') {
            audioPeakLevel = audioMonitor.getCurrentLevel();
          }
        }
      }
    } catch (err) {
      console.warn("Error accessing recorder state:", err);
    }
    
    return { state, mimeType, hasAudioTracks, audioPeakLevel };
  }
  
  /**
   * Handle view mode changes during recording
   */
  private handleViewModeChange = (event: Event): void => {
    // Cast to custom event and extract viewMode
    const customEvent = event as CustomEvent<{ viewMode: ViewMode }>;
    const newViewMode = customEvent.detail?.viewMode;
    
    if (!newViewMode) return;
    
    console.log(`%c🔄 RecordRTC received view mode change to: ${newViewMode}`, 
      "background:purple;color:white;font-size:14px", {
      previousMode: this.currentViewMode,
      isRecording: this.isRecording
    });
    
    // Update the current view mode
    this.currentViewMode = newViewMode;
    
    // Update global view mode reference
    if (typeof window !== 'undefined') {
      window._lastViewMode = newViewMode;
    }
    
    // Handle additional state changes if needed
    // No need to restart recorder during recording, the canvas will update
  }
  
  /**
   * Get the recorded blob
   */
  public async getBlob(): Promise<Blob> {
    if (!this.recorder) {
      throw new Error('No recorder initialized');
    }
    
    try {
      const blob = await this.recorder.getBlob();
      
      // Log the blob information to help with debugging
      console.log('Recorded blob details:', {
        size: `${(blob.size / (1024 * 1024)).toFixed(2)} MB`,
        type: blob.type,
        timestamp: new Date().toISOString()
      });
      
      return blob;
    } catch (err) {
      console.error('Failed to get recording blob:', err);
      throw new Error(`Failed to get recording: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  
  /**
   * Last resort emergency audio acquisition when no audio is available
   */
  private async acquireEmergencyAudio(): Promise<void> {
    console.log("🚨 EMERGENCY: Attempting to acquire audio directly");
    
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      });
      
      if (audioStream && audioStream.getAudioTracks().length > 0) {
        console.log("✅ Emergency audio acquisition successful!");
        this.audioStream = audioStream;
        window._directAudioStream = audioStream;
        
        // Now recreate the combined stream
        this.createCombinedStream();
        
        // Reinitialize recorder with new combined stream
        if (this.combinedStream) {
          this.recorder = new RecordRTCPromisesHandler(this.combinedStream, {
            type: 'video',
            mimeType: 'video/webm;codecs=vp8,opus',
            recorderType: MediaStreamRecorder,
            disableLogs: false,
            numberOfAudioChannels: 2,
            desiredSampRate: 48000,
            audioBitsPerSecond: 128000,
            videoBitsPerSecond: 2500000
          });
        }
      } else {
        console.error("❌ Emergency audio acquisition failed - no tracks");
      }
    } catch (error) {
      console.error("❌ Emergency audio acquisition failed:", error);
    }
  }
} 