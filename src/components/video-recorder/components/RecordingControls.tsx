import React from 'react';
import { RecordingControlsProps } from '../types';

const RecordingControls: React.FC<RecordingControlsProps> = ({
  recordingState,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  isPaused,
  showTeleprompter,
  onToggleTeleprompter,
  videoUrl
}) => {
  return (
    <div className="recording-controls mt-4 flex items-center justify-center space-x-4">
      {recordingState === 'idle' && !videoUrl && (
        <button
          onClick={onStartRecording}
          className="start-button px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 flex items-center"
        >
          <span className="mr-2">●</span>
          Start Recording
        </button>
      )}
      
      {recordingState === 'paused' && (
        <button
          onClick={onStartRecording}
          className="resume-button px-4 py-2 bg-green-600 text-white rounded-full hover:bg-green-700 flex items-center"
        >
          <span className="mr-2">▶</span>
          Resume Recording
        </button>
      )}
      
      {recordingState === 'recording' && (
        <>
          <button
            onClick={onPauseRecording}
            className="pause-button px-4 py-2 bg-yellow-600 text-white rounded-full hover:bg-yellow-700 flex items-center"
          >
            <span className="mr-2">⏸</span>
            Pause
          </button>
          
          <button
            onClick={onStopRecording}
            className="stop-button px-4 py-2 bg-gray-600 text-white rounded-full hover:bg-gray-700 flex items-center"
          >
            <span className="mr-2">■</span>
            Stop
          </button>
        </>
      )}
      
      {recordingState === 'processing' && (
        <div className="processing px-4 py-2 bg-blue-100 text-blue-800 rounded-full animate-pulse">
          Processing video...
        </div>
      )}
      
      {recordingState !== 'processing' && (
        <button
          onClick={onToggleTeleprompter}
          className={`teleprompter-toggle px-4 py-2 ${
            showTeleprompter ? 'bg-blue-600' : 'bg-gray-500'
          } text-white rounded-full hover:opacity-90`}
        >
          {showTeleprompter ? 'Hide Script' : 'Show Script'}
        </button>
      )}
      
      {videoUrl && recordingState === 'idle' && (
        <button
          onClick={onStartRecording}
          className="new-recording px-4 py-2 bg-green-600 text-white rounded-full hover:bg-green-700 flex items-center"
        >
          <span className="mr-2">●</span>
          New Recording
        </button>
      )}
    </div>
  );
};

export default RecordingControls; 