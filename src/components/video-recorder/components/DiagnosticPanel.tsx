import React, { useState } from 'react';
import { getSupportedMimeType } from '../utils/media-utils';

const DiagnosticPanel: React.FC = () => {
  const [diagnosticInfo, setDiagnosticInfo] = useState<string | null>(null);
  
  const runDiagnostics = async () => {
    console.log("Running video diagnostics...");
    
    try {
      const results: string[] = [];
      
      // Check browser capabilities
      results.push(`Browser: ${navigator.userAgent}`);
      results.push(`Chrome: ${/Chrome/.test(navigator.userAgent)}`);
      results.push(`Firefox: ${/Firefox/.test(navigator.userAgent)}`);
      results.push(`Safari: ${/Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)}`);
      results.push(`Edge: ${/Edg/.test(navigator.userAgent)}`);
      
      // Check MediaRecorder support
      results.push(`MediaRecorder support: ${typeof MediaRecorder !== 'undefined'}`);
      
      // Check codec support
      const supportedMimeType = getSupportedMimeType();
      results.push(`Preferred MIME type: ${supportedMimeType}`);
      
      // Check various MIME types
      const mimeTypes = [
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=h264,opus',
        'video/mp4;codecs=h264,aac',
        'video/webm',
        'video/mp4'
      ];
      
      results.push('Codec support:');
      mimeTypes.forEach(type => {
        const supported = MediaRecorder.isTypeSupported(type);
        results.push(`- ${type}: ${supported ? '✓' : 'X'}`);
      });
      
      // Test camera access
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();
        
        results.push(`Camera access: ${videoTracks.length > 0 ? '✓' : 'X'}`);
        results.push(`Microphone access: ${audioTracks.length > 0 ? '✓' : 'X'}`);
        
        if (videoTracks.length > 0) {
          results.push(`Camera: ${videoTracks[0].label}`);
        }
        
        if (audioTracks.length > 0) {
          results.push(`Microphone: ${audioTracks[0].label}`);
        }
        
        // Clean up
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        results.push(`Media access error: ${err}`);
      }
      
      setDiagnosticInfo(results.join('\n'));
    } catch (err) {
      setDiagnosticInfo(`Error running diagnostics: ${err}`);
    }
  };
  
  return (
    <div className="bg-gray-100 rounded-lg p-4">
      <h3 className="text-lg font-medium mb-2">Recording Preview</h3>
      
      <div className="p-4 bg-gray-200 rounded-lg mb-4 text-center text-gray-600">
        Record a video to see the preview here
      </div>
      
      <div className="mt-4">
        <button 
          onClick={runDiagnostics}
          className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
        >
          Run Video Diagnostics
        </button>
      </div>
      
      {diagnosticInfo && (
        <pre className="mt-4 p-3 bg-gray-800 text-green-400 rounded text-xs overflow-auto max-h-64">
          {diagnosticInfo}
        </pre>
      )}
    </div>
  );
};

export default DiagnosticPanel; 