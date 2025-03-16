// Add TypeScript definitions for standard HTML media properties
interface HTMLMediaElement {
  // Add missing audioTracks property that exists in standard browsers
  audioTracks?: {
    length: number;
    [index: number]: AudioTrack;
  };
}

interface AudioTrack {
  enabled: boolean;
  id: string;
  kind: string;
  label: string;
  language: string;
} 