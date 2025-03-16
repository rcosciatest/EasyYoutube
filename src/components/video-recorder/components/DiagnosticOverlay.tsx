import React, { useEffect, useState } from 'react';
import { ViewMode, RecordingState } from '../types';

interface DiagnosticOverlayProps {
  isVisible: boolean;
  viewMode: ViewMode;
  recordingState: RecordingState;
  audioTrackCount: number;
  canvasAudioTrackCount: number;
}

const DiagnosticOverlay: React.FC<DiagnosticOverlayProps> = ({
  isVisible,
  viewMode,
  recordingState,
  audioTrackCount,
  canvasAudioTrackCount
}) => {
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  
  // Set up audio analyser to visually verify audio
  useEffect(() => {
    if (!isVisible || recordingState !== 'recording') return;
    
    const setupAudioAnalyser = async () => {
      try {
        // Get the direct audio stream if available
        const audioStream = window._directAudioStream;
        if (!audioStream || !audioStream.active) {
          console.log("No active audio stream for diagnostic");
          return;
        }
        
        // Create audio context and analyser
        const context = new AudioContext();
        const source = context.createMediaStreamSource(audioStream);
        const analyserNode = context.createAnalyser();
        analyserNode.fftSize = 256;
        source.connect(analyserNode);
        
        setAudioContext(context);
        setAnalyser(analyserNode);
        
        // Start monitoring audio levels
        const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
        
        const updateAudioLevel = () => {
          if (analyserNode && document.visibilityState === 'visible') {
            analyserNode.getByteFrequencyData(dataArray);
            // Calculate average level
            const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            setAudioLevel(average);
            requestAnimationFrame(updateAudioLevel);
          }
        };
        
        updateAudioLevel();
        
        console.log("Audio analyser diagnostic is running");
      } catch (err) {
        console.error("Error setting up audio diagnostic:", err);
      }
    };
    
    setupAudioAnalyser();
    
    return () => {
      if (audioContext) {
        audioContext.close();
      }
    };
  }, [isVisible, recordingState]);
  
  if (!isVisible) return null;
  
  return (
    <div className="fixed bottom-0 right-0 bg-black bg-opacity-70 text-white p-2 rounded-tl-lg text-xs font-mono z-50">
      <div>Mode: {viewMode}</div>
      <div>Recording: {recordingState}</div>
      <div>
        Audio Tracks: {audioTrackCount} / Canvas: {canvasAudioTrackCount}
        <div className="w-full h-4 bg-gray-800 mt-1">
          <div 
            className="h-full bg-green-500" 
            style={{ width: `${Math.min(100, audioLevel / 2)}%` }}
          />
        </div>
      </div>
      <div className="text-xs mt-1">
        {audioLevel > 10 ? "Audio detected ✅" : "No audio ❌"}
      </div>
    </div>
  );
};

export default DiagnosticOverlay; 