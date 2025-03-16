import React, { useState, useRef, useEffect } from 'react';

interface TeleprompterProps {
  text: string;
}

const Teleprompter: React.FC<TeleprompterProps> = ({ text }) => {
  const [scrollSpeed, setScrollSpeed] = useState(1);
  const [isScrolling, setIsScrolling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<number | null>(null);

  // Start or stop scrolling
  const toggleScrolling = () => {
    if (isScrolling) {
      if (scrollIntervalRef.current) {
        window.clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    } else {
      scrollIntervalRef.current = window.setInterval(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop += scrollSpeed;
        }
      }, 50);
    }
    
    setIsScrolling(!isScrolling);
  };

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (scrollIntervalRef.current) {
        window.clearInterval(scrollIntervalRef.current);
      }
    };
  }, []);

  // Reset scroll position
  const resetScroll = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-medium text-white">Teleprompter</h3>
        <div className="flex items-center space-x-2">
          <label className="text-white text-sm">Speed:</label>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.5"
            value={scrollSpeed}
            onChange={(e) => setScrollSpeed(parseFloat(e.target.value))}
            className="w-24"
          />
          <button
            onClick={toggleScrolling}
            className={`px-3 py-1 rounded text-sm ${
              isScrolling ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
            } text-white`}
          >
            {isScrolling ? 'Stop' : 'Start'}
          </button>
          <button
            onClick={resetScroll}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm text-white"
          >
            Reset
          </button>
        </div>
      </div>
      
      <div 
        ref={containerRef}
        className="bg-black text-white p-4 rounded-lg h-40 overflow-y-auto font-medium text-lg"
      >
        {text.split('\n').map((paragraph, index) => (
          <p key={index} className="mb-4">{paragraph}</p>
        ))}
      </div>
    </div>
  );
};

export default Teleprompter; 