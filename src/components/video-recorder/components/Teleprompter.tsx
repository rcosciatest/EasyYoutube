import React, { useState, useRef, useEffect } from 'react';

interface TeleprompterProps {
  script: string | string[];
}

const Teleprompter: React.FC<TeleprompterProps> = ({ script }) => {
  const [speed, setSpeed] = useState<number>(2); // pixels per second
  const [isScrolling, setIsScrolling] = useState<boolean>(false);
  const [position, setPosition] = useState<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  
  // Convert array to string if needed
  const scriptContent = Array.isArray(script) ? script.join('\n\n') : script;
  
  // Handle auto-scrolling animation
  const animate = () => {
    if (!isScrolling) return;
    
    setPosition(prev => {
      const newPosition = prev + speed * 0.1;
      
      // Check if we've reached the end
      if (contentRef.current && containerRef.current) {
        const maxScroll = contentRef.current.scrollHeight - containerRef.current.clientHeight;
        if (newPosition >= maxScroll) {
          setIsScrolling(false);
          return maxScroll;
        }
      }
      
      return newPosition;
    });
    
    animationRef.current = requestAnimationFrame(animate);
  };
  
  // Start/stop scrolling
  const toggleScrolling = () => {
    setIsScrolling(!isScrolling);
  };
  
  // Reset to top
  const resetScroll = () => {
    setPosition(0);
    setIsScrolling(false);
  };
  
  // Update scroll position when position state changes
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = position;
    }
  }, [position]);
  
  // Handle animation frame
  useEffect(() => {
    if (isScrolling) {
      animationRef.current = requestAnimationFrame(animate);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isScrolling]);
  
  // Format script with paragraphs
  const formattedScript = scriptContent.split('\n\n').map((paragraph, index) => (
    <p key={index} className="mb-6">{paragraph}</p>
  ));
  
  return (
    <div className="teleprompter-container bg-black bg-opacity-95 text-white p-4 rounded-lg shadow-lg">
      <div className="controls flex gap-4 mb-4">
        <button 
          onClick={toggleScrolling}
          className={`px-4 py-2 rounded ${
            isScrolling ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
          }`}
        >
          {isScrolling ? 'Pause' : 'Start'} Scrolling
        </button>
        
        <button 
          onClick={resetScroll}
          className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-700"
        >
          Reset
        </button>
        
        <div className="speed-control flex items-center gap-2">
          <label className="text-sm">Speed:</label>
          <input 
            type="range" 
            min="1" 
            max="10" 
            value={speed} 
            onChange={(e) => setSpeed(parseInt(e.target.value))}
            className="w-24"
          />
          <span className="text-sm">{speed}</span>
        </div>
      </div>
      
      <div 
        ref={containerRef}
        className="script-container h-64 overflow-y-scroll"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div ref={contentRef} className="script-content text-center text-xl leading-relaxed p-4">
          {formattedScript}
        </div>
      </div>
    </div>
  );
};

export default Teleprompter; 