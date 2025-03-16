declare global {
  interface MediaRecorder {
    pause(): void;
    resume(): void;
  }

  interface MediaRecorderOptions {
    mimeType?: string;
    audioBitsPerSecond?: number;
    videoBitsPerSecond?: number;
    bitsPerSecond?: number;
  }

  interface MediaRecorderErrorEvent extends Event {
    name: string;
  }

  interface Window {
    // Any additions to Window interface
  }
}

export {};