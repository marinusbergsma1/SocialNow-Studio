
import React, { useState, useEffect } from 'react';
import { X, RotateCcw, Minus, Plus } from 'lucide-react';

interface ImagePreviewProps {
  src: string;
  onClose: () => void;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({ src, onClose }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Reset when src changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [src]);

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const delta = -Math.sign(e.deltaY) * 0.5;
    const newScale = Math.min(Math.max(1, scale + delta), 8);
    setScale(newScale);
    if (newScale === 1) setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale === 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  const handleReset = (e: React.MouseEvent) => {
      e.stopPropagation();
      setScale(1);
      setPosition({ x: 0, y: 0 });
  };

  return (
    <div 
        className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center animate-in fade-in duration-200 overflow-hidden"
        onWheel={handleWheel}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={(e) => { if(scale === 1) onClose(); }}
    >
        {/* Controls Toolbar */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-50" onClick={(e) => e.stopPropagation()}>
            <div className="bg-zinc-900/90 backdrop-blur rounded-full border border-white/10 flex items-center p-1 shadow-2xl">
                 <button onClick={() => { setScale(s => Math.max(1, s - 0.5)); if(scale <= 1.5) setPosition({x:0, y:0}); }} className="p-2.5 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors"><Minus size={18} /></button>
                 <span className="text-xs font-mono w-12 text-center text-zinc-300 select-none">{Math.round(scale * 100)}%</span>
                 <button onClick={() => setScale(s => Math.min(8, s + 0.5))} className="p-2.5 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors"><Plus size={18} /></button>
                 <div className="w-px h-4 bg-white/10 mx-1" />
                 <button onClick={handleReset} className="p-2.5 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors" title="Reset View"><RotateCcw size={16} /></button>
            </div>
            
            <button 
                onClick={onClose} 
                className="p-3 bg-zinc-900/90 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 rounded-full border border-white/10 transition-colors shadow-2xl"
            >
                <X size={20} />
            </button>
        </div>

        {/* Image Stage */}
        <div 
            className={`w-full h-full flex items-center justify-center ${scale > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onClick={(e) => e.stopPropagation()} 
        >
            <img 
                src={src} 
                alt="Preview" 
                className="max-w-[95vw] max-h-[95vh] object-contain transition-transform duration-100 ease-out select-none rounded-sm shadow-2xl pointer-events-none" 
                style={{ 
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`
                }}
            />
        </div>
        
        {/* Hint */}
        {scale === 1 && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center pointer-events-none animate-in fade-in slide-in-from-bottom-4 delay-500">
                <span className="bg-black/50 backdrop-blur px-4 py-2 rounded-full text-[10px] font-mono text-zinc-500 border border-white/5 tracking-wider">
                    SCROLL TO ZOOM
                </span>
            </div>
        )}
    </div>
  );
};
