import React from 'react';
import { MediaPlayer } from '../components/media_player';

export const YourPage: React.FC = () => {
  const videoUrl = 'your-video-url-here';
  
  return (
    <div>
      {videoUrl && <MediaPlayer videoUrl={videoUrl} />}
    </div>
  );
}; 