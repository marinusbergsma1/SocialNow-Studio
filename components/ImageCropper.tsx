
import React, { useState, useRef, useEffect } from 'react';
import { X, Check, ZoomIn, ZoomOut, Move } from 'lucide-react';

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedBase64: string) => void;
  onCancel: () => void;
  aspect: number;
}

export const ImageCropper: React.FC<ImageCropperProps> = ({ imageSrc, onCropComplete, onCancel, aspect }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [imageSrc]);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    // Prevent default to stop scrolling on touch devices while dragging
    // e.preventDefault(); 
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setDragStart({ x: clientX - position.x, y: clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setPosition({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCrop = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;
    
    if (!ctx || !img) return;

    // Use specific high-res output size
    const outputW = 1000;
    const outputH = outputW / aspect;
    
    canvas.width = outputW;
    canvas.height = outputH;

    // Calculate source rect
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    const renderedW = img.width;
    
    // Scale ratio between rendered (at scale 1) and natural
    const ratio = renderedW / naturalW;

    // Viewport Center
    const cx = (containerRef.current?.clientWidth || 0) / 2;
    const cy = (containerRef.current?.clientHeight || 0) / 2;

    // Crop Box dimensions (matches visual CSS)
    const viewportW = containerRef.current?.clientWidth || 0;
    const viewportH = containerRef.current?.clientHeight || 0;
    const maxH = viewportH * 0.8;
    const maxW = viewportW * 0.9;
    
    let cropW = maxW;
    let cropH = cropW / aspect;
    if (cropH > maxH) {
        cropH = maxH;
        cropW = cropH * aspect;
    }

    // Map CropBox TopLeft (relative to viewport) to Source Image Coordinates
    const cropBoxLeft = cx - cropW / 2;
    const cropBoxTop = cy - cropH / 2;

    // Image TopLeft (relative to viewport)
    // Image is centered at (cx + pos.x, cy + pos.y) then scaled
    const imgLeft = cx + position.x - (renderedW * scale) / 2;
    const imgTop = cy + position.y - ((renderedW / (naturalW/naturalH)) * scale) / 2; // approximation using ratio

    // Actually, easier way: map the offset
    // Offset of CropBox start relative to Image start (in Screen Pixels)
    const offsetX = cropBoxLeft - imgLeft;
    const offsetY = cropBoxTop - imgTop;

    // Convert to Source Pixels
    const srcX = offsetX / scale / ratio;
    const srcY = offsetY / scale / ratio;
    const srcW = cropW / scale / ratio;
    const srcH = cropH / scale / ratio;

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, outputW, outputH);
    // Draw the portion of the image that lies under the crop box
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outputW, outputH);
    
    onCropComplete(canvas.toDataURL('image/png'));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col font-sans select-none animate-in fade-in duration-300">
      <div className="p-4 flex justify-between items-center bg-zinc-900/50 backdrop-blur border-b border-white/5 z-10">
        <span className="text-xs font-mono font-bold text-zinc-400 tracking-widest">CROP REFERENCE</span>
        <button onClick={onCancel} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-zinc-950 flex items-center justify-center cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
      >
        <img 
          ref={imageRef}
          src={imageSrc}
          alt="Target"
          draggable={false}
          className="max-w-[80vw] max-h-[80vh] object-contain transition-transform duration-75 ease-linear pointer-events-none"
          style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}
        />

        {/* Overlay with hole using borders */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div 
                className="border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.85)]"
                style={{
                    aspectRatio: `${aspect}`,
                    width: aspect < 1 ? 'auto' : '90%',
                    height: aspect < 1 ? '80%' : 'auto',
                    maxWidth: '90%',
                    maxHeight: '80%'
                }}
            >
                {/* Rule of thirds grid */}
                <div className="w-full h-full flex flex-col opacity-50">
                    <div className="flex-1 flex border-b border-white/20">
                         <div className="flex-1 border-r border-white/20"></div>
                         <div className="flex-1 border-r border-white/20"></div>
                         <div className="flex-1"></div>
                    </div>
                    <div className="flex-1 flex border-b border-white/20">
                         <div className="flex-1 border-r border-white/20"></div>
                         <div className="flex-1 border-r border-white/20"></div>
                         <div className="flex-1"></div>
                    </div>
                    <div className="flex-1 flex">
                         <div className="flex-1 border-r border-white/20"></div>
                         <div className="flex-1 border-r border-white/20"></div>
                         <div className="flex-1"></div>
                    </div>
                </div>
            </div>
        </div>
        
        {/* Helper text */}
        <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none opacity-50 text-[10px] font-mono text-zinc-400">
            <Move className="inline-block mr-1" size={12}/> DRAG TO ADJUST
        </div>
      </div>

      <div className="p-6 bg-zinc-900 border-t border-white/5 flex flex-col gap-4">
        <div className="flex items-center gap-4 px-2">
           <ZoomOut size={16} className="text-zinc-500" />
           <input 
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-white"
           />
           <ZoomIn size={16} className="text-zinc-500" />
        </div>
        <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold text-xs tracking-wider transition-colors">
                CANCEL
            </button>
            <button onClick={handleCrop} className="flex-1 py-3 bg-white hover:bg-zinc-200 text-black rounded-xl font-bold text-xs tracking-wider flex items-center justify-center gap-2 transition-colors">
                <Check size={16} /> CONFIRM
            </button>
        </div>
      </div>
    </div>
  );
};
