declare module 'recordrtc' {
  export interface RecordRTCConfiguration {
    type?: string;
    mimeType?: string;
    disableLogs?: boolean;
    recorderType?: any;
    timeSlice?: number;
    numberOfAudioChannels?: number;
    desiredSampRate?: number;
    videoBitsPerSecond?: number;
    frameRate?: number;
    audioBitsPerSecond?: number;
  }
  
  // Define the state object shape
  export interface RecordRTCState {
    state: string;
    mimeType: string;
    buffer: any[];
    sampleRate?: number;
    bufferSize?: number;
    [key: string]: any; // Allow for other properties
  }
  
  export class RecordRTCPromisesHandler {
    constructor(stream: MediaStream, options?: RecordRTCConfiguration);
    startRecording(): Promise<void>;
    stopRecording(): Promise<void>;
    getBlob(): Promise<Blob>;
    getState(): RecordRTCState;
    destroy(): void;
  }
  
  export class MediaStreamRecorder {}
  
  // Use proper module export syntax
  const RecordRTC: any;
  export default RecordRTC;
} 