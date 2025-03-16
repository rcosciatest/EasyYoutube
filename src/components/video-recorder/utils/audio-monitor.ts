/**
 * Audio monitoring utility to help debug audio issues
 */
export class AudioMonitor {
  private static instance: AudioMonitor | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private isMonitoring = false;
  private audioTrack: MediaStreamTrack | null = null;
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): AudioMonitor {
    if (!AudioMonitor.instance) {
      AudioMonitor.instance = new AudioMonitor();
    }
    return AudioMonitor.instance;
  }
  
  /**
   * Start monitoring audio levels from a stream
   */
  public startMonitoring(stream: MediaStream | null): void {
    // Clean up previous monitoring if any
    this.stopMonitoring();
    
    if (!stream || stream.getAudioTracks().length === 0) {
      console.warn("No audio tracks to monitor!");
      return;
    }
    
    try {
      this.audioTrack = stream.getAudioTracks()[0];
      console.log(`🎙️ Monitoring audio track: ${this.audioTrack.label}`);
      
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      
      // Create a fresh stream with just the audio track to monitor
      const audioOnlyStream = new MediaStream([this.audioTrack]);
      this.source = this.audioContext.createMediaStreamSource(audioOnlyStream);
      this.source.connect(this.analyser);
      
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      
      this.isMonitoring = true;
      this.checkAudioLevels();
      
      console.log("Audio monitoring started");
    } catch (err) {
      console.error("Failed to start audio monitoring:", err);
    }
  }
  
  /**
   * Stop monitoring audio
   */
  public stopMonitoring(): void {
    this.isMonitoring = false;
    
    if (this.source) {
      try {
        this.source.disconnect();
      } catch (e) {
        // Ignore
      }
      this.source = null;
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch (e) {
        // Ignore
      }
    }
    
    this.audioContext = null;
    this.analyser = null;
    this.dataArray = null;
    this.audioTrack = null;
    
    console.log("Audio monitoring stopped");
  }
  
  /**
   * Check audio levels periodically
   */
  private checkAudioLevels(): void {
    if (!this.isMonitoring || !this.analyser || !this.dataArray) {
      return;
    }
    
    try {
      this.analyser.getByteFrequencyData(this.dataArray);
      const sum = this.dataArray.reduce((acc, val) => acc + val, 0);
      const avg = sum / this.dataArray.length;
      
      // Only log significant audio
      if (avg > 5) {
        console.log(`%c🔊 Audio level: ${avg.toFixed(1)}`, 
          `background:${avg > 20 ? 'green' : 'orange'};color:white`);
      }
      
      // Continue monitoring
      setTimeout(() => this.checkAudioLevels(), 500);
    } catch (err) {
      console.warn("Error checking audio levels:", err);
      this.isMonitoring = false;
    }
  }
  
  /**
   * Get the current audio level (0-100)
   */
  public getCurrentLevel(): number {
    if (!this.isMonitoring || !this.analyser || !this.dataArray) {
      return 0;
    }
    
    try {
      this.analyser.getByteFrequencyData(this.dataArray);
      const sum = this.dataArray.reduce((acc, val) => acc + val, 0);
      return sum / this.dataArray.length;
    } catch (err) {
      return 0;
    }
  }
}

// Create and export a singleton instance
export const audioMonitor = AudioMonitor.getInstance(); 