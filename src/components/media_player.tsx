import React, { useState } from 'react';

interface MediaPlayerProps {
  videoUrl: string;
  onError?: (message: string) => void;
}

export const MediaPlayer: React.FC<MediaPlayerProps> = ({ 
  videoUrl, 
  onError = () => {} 
}) => {
  const [useAudioPlayer, setUseAudioPlayer] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleError = (message: string) => {
    setError(message);
    onError(message);
  };

  if (!videoUrl) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Recording Preview</h3>
      {!useAudioPlayer ? (
        <video 
          src={videoUrl} 
          controls 
          className="w-full rounded-lg shadow-sm"
          playsInline
          preload="metadata"
          onError={(e) => {
            console.error('Video preview error:', e);
            handleError('Error playing the video. Switching to audio-only player.');
            setUseAudioPlayer(true);
          }}
        />
      ) : (
        <div className="bg-gray-100 p-4 rounded-lg">
          <p className="mb-2 text-sm text-gray-600">Video preview not available. Audio only:</p>
          <audio 
            src={videoUrl} 
            controls 
            className="w-full"
            onError={(e) => {
              console.error('Audio preview error:', e);
              handleError('Unable to play the recording. Please try downloading it instead.');
            }}
          />
        </div>
      )}
      
      {error && (
        <div className="text-red-500 text-sm mt-2">
          {error}
        </div>
      )}
    </div>
  );
};

export default MediaPlayer; 