import React from 'react';
import { ViewMode, RecordingState } from './types';

interface RecordingControlsProps {
  recordingState: RecordingState;
  viewMode: ViewMode;
  recordingDuration: number;
  showTeleprompter: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onToggleViewMode: (mode: ViewMode) => Promise<void>;
  onToggleTeleprompter: () => void;
}

const RecordingControls: React.FC<RecordingControlsProps> = ({
  recordingState,
  viewMode,
  recordingDuration,
  showTeleprompter,
  onStartRecording,
  onStopRecording,
  onToggleViewMode,
  onToggleTeleprompter
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="flex flex-col gap-4 mt-4">
      {/* View mode controls */}
      <div className="flex gap-2">
        <button
          className={`px-4 py-2 rounded-lg flex items-center ${viewMode === 'full' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
          onClick={() => onToggleViewMode('full')}
          disabled={recordingState === 'recording'}
        >
          <span className="mr-1">←</span> Full Camera
        </button>
        
        <button
          className={`px-4 py-2 rounded-lg flex items-center ${viewMode === 'split' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
          onClick={() => onToggleViewMode('split')}
          disabled={recordingState === 'recording'}
        >
          Tutorial View <span className="ml-1">→</span>
        </button>
        
        <div className="text-xs text-gray-500 flex items-center ml-2">
          Use arrow keys to switch views
        </div>
      </div>
      
      {/* Recording controls */}
      <div className="flex gap-4 items-center">
        {recordingState === 'idle' ? (
          <button
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            onClick={onStartRecording}
          >
            Start Recording
          </button>
        ) : (
          <button
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
            onClick={onStopRecording}
          >
            Stop Recording {recordingDuration > 0 && `(${formatTime(recordingDuration)})`}
          </button>
        )}
        
        <button
          className={`px-6 py-3 rounded-lg ${showTeleprompter ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}
          onClick={onToggleTeleprompter}
        >
          {showTeleprompter ? 'Hide Teleprompter' : 'Show Teleprompter'}
        </button>
      </div>
    </div>
  );
};

export default RecordingControls; 