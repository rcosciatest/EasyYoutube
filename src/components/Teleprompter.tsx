import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface TeleprompterProps {
  script: string;
  position: 'overlay' | 'side' | 'bottom';
  onClose: () => void;
}

const Teleprompter: React.FC<TeleprompterProps> = ({ script, position, onClose }) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [scrollSpeed, setScrollSpeed] = useState<number>(2);
  const [fontSize, setFontSize] = useState<number>(32);
  const [currentPosition, setCurrentPosition] = useState<number>(0);
  const [opacity, setOpacity] = useState<number>(0.8);
  const teleprompterRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [position_, setPosition_] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  
  const startScrolling = () => {
    setIsPlaying(true);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    
    const scrollStep = () => {
      if (teleprompterRef.current) {
        teleprompterRef.current.scrollTop += scrollSpeed;
        setCurrentPosition(teleprompterRef.current.scrollTop);
        
        animationRef.current = requestAnimationFrame(scrollStep);
      }
    };
    
    animationRef.current = requestAnimationFrame(scrollStep);
  };
  
  const pauseScrolling = () => {
    setIsPlaying(false);
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  };
  
  const resetScrolling = () => {
    pauseScrolling();
    if (teleprompterRef.current) {
      teleprompterRef.current.scrollTop = 0;
      setCurrentPosition(0);
    }
  };
  
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Handle dragging for the teleprompter
  const handleMouseDown = (e: React.MouseEvent) => {
    if (position !== 'overlay') return;
    
    setIsDragging(true);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      dragStartRef.current = { 
        x: e.clientX - rect.left, 
        y: e.clientY - rect.top 
      };
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging && containerRef.current) {
      const newX = e.clientX - dragStartRef.current.x;
      const newY = e.clientY - dragStartRef.current.y;
      setPosition_({ x: newX, y: newY });
    }
  }, [isDragging]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mouseup', handleMouseUp as unknown as EventListener);
      document.addEventListener('mousemove', handleMouseMove as unknown as EventListener);
    } else {
      document.removeEventListener('mouseup', handleMouseUp as unknown as EventListener);
      document.removeEventListener('mousemove', handleMouseMove as unknown as EventListener);
    }
    
    return () => {
      document.removeEventListener('mouseup', handleMouseUp as unknown as EventListener);
      document.removeEventListener('mousemove', handleMouseMove as unknown as EventListener);
    };
  }, [isDragging]);

  // Determine the teleprompter style based on position
  const getContainerStyle = () => {
    if (position === 'overlay') {
      return {
        position: 'fixed' as const,
        top: position_.y,
        left: position_.x,
        transform: 'none',
        width: '400px',
        height: '300px',
        zIndex: 50,
        backgroundColor: `rgba(0, 0, 0, ${opacity})`,
        cursor: isDragging ? 'grabbing' : 'grab'
      };
    } else if (position === 'side') {
      return {
        position: 'absolute' as const,
        top: '0',
        right: '-420px',
        width: '400px',
        height: '100%',
        zIndex: 40
      };
    } else { // bottom
      return {
        position: 'absolute' as const,
        bottom: '-320px',
        left: '0',
        width: '100%',
        height: '300px',
        zIndex: 40
      };
    }
  };
  
  return (
    <div 
      ref={containerRef}
      className={`rounded-lg overflow-hidden flex flex-col ${position === 'overlay' ? '' : 'absolute'}`}
      style={getContainerStyle()}
      onMouseDown={handleMouseDown}
    >
      <div className="bg-gray-800 p-2 flex justify-between items-center" onMouseDown={handleMouseDown}>
        <h2 className="text-white text-sm font-bold">Teleprompter</h2>
        <div className="flex items-center space-x-2">
          {position === 'overlay' && (
            <input
              type="range"
              min="0.2"
              max="1"
              step="0.1"
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              className="w-16 h-2"
              aria-label="Opacity"
            />
          )}
          <button 
            onClick={onClose} 
            className="text-gray-300 hover:text-white"
            aria-label="Close teleprompter"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      
      <div 
        ref={teleprompterRef}
        className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-600 bg-black"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div 
          className="text-white whitespace-pre-wrap mx-auto max-w-2xl text-center" 
          style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}
        >
          {script}
        </div>
        <div className="h-[300px]"></div> {/* Extra space for scrolling */}
      </div>
      
      <div className="bg-gray-800 p-2 flex flex-wrap justify-between items-center">
        <div className="flex items-center space-x-2">
          <button
            onClick={isPlaying ? pauseScrolling : startScrolling}
            className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-md text-xs"
            aria-label={isPlaying ? "Pause teleprompter" : "Start teleprompter"}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            onClick={resetScrolling}
            className="bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded-md text-xs"
            aria-label="Reset teleprompter"
          >
            Reset
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-white text-xs">Speed:</span>
          <input
            type="range"
            min="1"
            max="10"
            value={scrollSpeed}
            onChange={(e) => setScrollSpeed(parseInt(e.target.value))}
            className="w-16 h-2"
            aria-label="Scroll speed"
          />
          <span className="text-white text-xs">{scrollSpeed}</span>
          
          <span className="text-white text-xs ml-2">Size:</span>
          <button
            onClick={() => setFontSize(Math.max(16, fontSize - 4))}
            className="bg-gray-700 hover:bg-gray-600 text-white px-1 py-0.5 rounded-md text-xs"
            aria-label="Decrease font size"
          >
            -
          </button>
          <span className="text-white text-xs">{fontSize}</span>
          <button
            onClick={() => setFontSize(Math.min(72, fontSize + 4))}
            className="bg-gray-700 hover:bg-gray-600 text-white px-1 py-0.5 rounded-md text-xs"
            aria-label="Increase font size"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
};

export default Teleprompter; 