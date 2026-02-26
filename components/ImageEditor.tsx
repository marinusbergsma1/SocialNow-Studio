
import React, { useState, useRef, useEffect } from 'react';
import { X, Eraser, Check, Loader2, Eye, ArrowLeftRight, Save, Undo, RefreshCw, Trash, Scan, Rocket, Undo2 } from 'lucide-react';

interface ImageEditorProps {
  imageBase64: string;
  onClose: () => void;
  onSave: (newImageBase64: string) => void;
  onGenerate: (maskBase64: string, prompt: string, aspectRatio: string) => Promise<{ data: string; mimeType: string }>;
  initialAspectRatio?: string;
}

const ASPECT_RATIOS = [
    { label: '1:1', value: '1:1' },
    { label: '3:4', value: '3:4' },
    { label: '4:3', value: '4:3' },
    { label: '9:16', value: '9:16' },
    { label: '16:9', value: '16:9' },
  ];

export const ImageEditor: React.FC<ImageEditorProps> = ({ imageBase64, onClose, onSave, onGenerate, initialAspectRatio = '3:4' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null); // NEW: Hidden canvas for pure mask
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Store full object for generated image to handle mime type
  const [generatedImage, setGeneratedImage] = useState<{ data: string; mimeType: string } | null>(null);
  
  const [showOriginal, setShowOriginal] = useState(false);
  const [brushSize, setBrushSize] = useState(25);
  const [aspectRatio, setAspectRatio] = useState(initialAspectRatio);
  const [showRatioMenu, setShowRatioMenu] = useState(false);

  // Undo History now tracks both the display canvas and the mask canvas
  const [history, setHistory] = useState<{ display: ImageData; mask: ImageData }[]>([]);

  // Helper to handle mixed base64 formats (raw vs data url)
  const getSafeSrc = (content: string) => {
      if (content.startsWith('data:')) return content;
      return `data:image/png;base64,${content}`;
  };

  const parseRatio = (r: string) => {
      const parts = r.split(':').map(Number);
      if (parts.length === 2 && parts[1] !== 0) return parts[0] / parts[1];
      return 1;
  };

  // Shared logic to draw the base image
  const drawBaseImage = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const img = new Image();
      img.src = getSafeSrc(imageBase64);
      img.onload = () => {
          ctx.drawImage(img, 0, 0, width, height);
      };
  };

  // Initialize Canvas with Image & Detect Aspect Ratio
  useEffect(() => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !maskCanvas || !container) return;

    const ctx = canvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    if (!ctx || !maskCtx) return;

    const img = new Image();
    img.src = getSafeSrc(imageBase64);
    
    img.onload = () => {
      // 1. Auto-detect aspect ratio
      const imgRatio = img.width / img.height;
      let closestRatio = ASPECT_RATIOS[0];
      let minDiff = Infinity;

      ASPECT_RATIOS.forEach(r => {
          const val = parseRatio(r.value);
          const diff = Math.abs(val - imgRatio);
          if (diff < minDiff) {
              minDiff = diff;
              closestRatio = r;
          }
      });
      setAspectRatio(closestRatio.value);

      // 2. Setup Canvas
      const aspectRatio = img.width / img.height;
      const maxHeight = container.clientHeight * 0.95;
      const maxWidth = container.clientWidth * 0.95;
      
      let drawWidth = maxWidth;
      let drawHeight = maxWidth / aspectRatio;

      if (drawHeight > maxHeight) {
        drawHeight = maxHeight;
        drawWidth = maxHeight * aspectRatio;
      }

      // Resize both canvases
      canvas.width = drawWidth;
      canvas.height = drawHeight;
      maskCanvas.width = drawWidth;
      maskCanvas.height = drawHeight;

      // Draw original image on Display Canvas
      ctx.drawImage(img, 0, 0, drawWidth, drawHeight);

      // Initialize Mask Canvas with BLACK (Solid)
      // The AI needs Black = Protect, White = Change
      maskCtx.fillStyle = '#000000';
      maskCtx.fillRect(0, 0, drawWidth, drawHeight);
      
      // Reset history on new image load
      setHistory([]);
    };
    
    img.onerror = () => {
        console.error("Failed to load image in editor");
    };

  }, [imageBase64]);

  const saveState = () => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!canvas || !maskCanvas) return;
    
    const ctx = canvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    
    if (ctx && maskCtx) {
        // Capture snapshots of both canvases
        const displayData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
        
        setHistory(prev => {
            const newHistory = [...prev, { display: displayData, mask: maskData }];
            // Limit history to 20 steps to prevent memory bloat
            if (newHistory.length > 20) return newHistory.slice(1);
            return newHistory;
        });
    }
  };

  const handleUndo = () => {
      if (history.length === 0) return;
      
      const canvas = canvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      if (!canvas || !maskCanvas) return;
      
      const ctx = canvas.getContext('2d');
      const maskCtx = maskCanvas.getContext('2d');
      if (!ctx || !maskCtx) return;

      // Get last state
      const previousState = history[history.length - 1];
      
      // Restore both
      ctx.putImageData(previousState.display, 0, 0);
      maskCtx.putImageData(previousState.mask, 0, 0);
      
      // Remove from history
      setHistory(prev => prev.slice(0, -1));
  };

  const handleInvertMask = () => {
    const maskCanvas = maskCanvasRef.current;
    const canvas = canvasRef.current;
    if (!maskCanvas || !canvas) return;

    const maskCtx = maskCanvas.getContext('2d');
    const ctx = canvas.getContext('2d');
    if (!maskCtx || !ctx) return;

    saveState();

    // 1. Invert the Logic Mask (Hidden)
    const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    const data = maskData.data;
    for (let i = 0; i < data.length; i += 4) {
        // Invert channels (255 becomes 0, 0 becomes 255)
        const val = data[i]; // Red channel check is enough for grayscale mask
        const newVal = 255 - val;
        data[i] = newVal;
        data[i+1] = newVal;
        data[i+2] = newVal;
        // Alpha stays 255
    }
    maskCtx.putImageData(maskData, 0, 0);

    // 2. Update the Visual Display
    // We recreate the visual state: Original Image + White Overlay where mask is White
    const baseImg = new Image();
    baseImg.src = getSafeSrc(imageBase64);
    
    baseImg.onload = () => {
        // Draw Clean Image
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);

        // Prepare Overlay
        // We need a temp canvas to hold the visual white overlay
        const tempC = document.createElement('canvas');
        tempC.width = canvas.width;
        tempC.height = canvas.height;
        const tempCtx = tempC.getContext('2d');
        
        if (tempCtx) {
            // Create visual overlay data: White pixels with full alpha, Transparent pixels elsewhere
            const visualData = tempCtx.createImageData(canvas.width, canvas.height);
            const vData = visualData.data;
            
            for(let i=0; i<data.length; i+=4) {
                // If mask is White (Change area)
                if (data[i] > 100) {
                    vData[i] = 255;   // R
                    vData[i+1] = 255; // G
                    vData[i+2] = 255; // B
                    vData[i+3] = 255; // A (We rely on globalAlpha for transparency blending)
                } else {
                    vData[i+3] = 0;   // Transparent
                }
            }
            tempCtx.putImageData(visualData, 0, 0);
            
            // Draw Overlay on Display Canvas
            ctx.save();
            ctx.globalAlpha = 0.6; // Semi-transparent white
            ctx.drawImage(tempC, 0, 0);
            ctx.restore();
        }
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (generatedImage) return; // Disable drawing if result exists
    
    saveState(); // Capture state before new stroke
    
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    canvas?.getContext('2d')?.beginPath();
    maskCanvas?.getContext('2d')?.beginPath();
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || generatedImage) return;

    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!canvas || !maskCanvas) return;

    const ctx = canvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    if (!ctx || !maskCtx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Draw on Visible Canvas (Semi-transparent white for feedback)
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'; // Semi-transparent white
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);

    // Draw on Mask Canvas (Solid White)
    maskCtx.lineWidth = brushSize;
    maskCtx.lineCap = 'round';
    maskCtx.strokeStyle = '#FFFFFF'; // Solid White
    maskCtx.lineTo(x, y);
    maskCtx.stroke();
    maskCtx.beginPath();
    maskCtx.moveTo(x, y);
  };

  // CLEARS THE MASK BUT KEEPS THE IMAGE (Eraser)
  const handleResetMask = () => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!canvas || !maskCanvas) return;

    const ctx = canvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    if (!ctx || !maskCtx) return;

    // Reset Display Canvas (Redraw Base Image)
    drawBaseImage(ctx, canvas.width, canvas.height);
    
    // Reset Mask Canvas (Fill Black)
    maskCtx.fillStyle = '#000000';
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    
    setHistory([]);
  };

  // DISCARDS THE GENERATED RESULT, BUT KEEPS THE MASK (Trash)
  const handleDiscardResult = () => {
      setGeneratedImage(null);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);

    try {
        const maskCanvas = maskCanvasRef.current;
        if (!maskCanvas) return;
        
        // Generate pure B&W mask data
        const maskReference = maskCanvas.toDataURL('image/png');
        
        // Pass aspect ratio here
        const result = await onGenerate(maskReference, prompt, aspectRatio);
        setGeneratedImage(result);
    } catch (e) {
        alert("Edit failed: " + (e instanceof Error ? e.message : "Unknown"));
    } finally {
        setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col animate-in fade-in duration-200 font-sans">
      
      {/* Top Bar - Minimalist */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-none z-10">
         <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 pointer-events-auto">
             <span className="text-[10px] font-mono text-green-500 font-bold tracking-widest">FLASH EDITOR // MASK MODE</span>
         </div>
         <button onClick={onClose} className="p-2 bg-black/50 backdrop-blur-md rounded-full border border-white/10 text-zinc-400 hover:text-white pointer-events-auto transition-colors">
            <X size={18} />
         </button>
      </div>

      {/* Main Canvas Area */}
      <div 
        ref={containerRef}
        className="flex-1 relative flex items-center justify-center overflow-hidden touch-none"
      >
        {/* Hidden Mask Canvas (Used for AI Logic) */}
        <canvas ref={maskCanvasRef} className="hidden" />

        {/* Visible Display Canvas (User Interaction) */}
        <canvas 
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onMouseMove={draw}
            onTouchStart={startDrawing}
            onTouchEnd={stopDrawing}
            onTouchMove={draw}
            className={`shadow-2xl rounded-lg ${generatedImage ? 'hidden' : 'cursor-crosshair'}`}
            style={{ boxShadow: '0 0 50px rgba(0,0,0,0.5)' }}
        />
        
        {/* Generated Image Display */}
        {generatedImage && (
            <img 
                src={showOriginal ? getSafeSrc(imageBase64) : `data:${generatedImage.mimeType};base64,${generatedImage.data}`}
                className="max-w-[95%] max-h-[95%] object-contain rounded-lg shadow-2xl"
                style={{ boxShadow: '0 0 50px rgba(0,0,0,0.5)' }}
                alt="Edited Result"
            />
        )}
      </div>

      {/* Floating Controls - Clean Island Design */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 p-2 rounded-2xl shadow-2xl flex flex-col gap-3 w-full max-w-xl transition-all">
            
            {!generatedImage ? (
                <>
                    {/* Brush & Clear & Undo */}
                    <div className="flex items-center gap-4 px-2">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Mask Size</span>
                        <input 
                            type="range" 
                            min="5" 
                            max="80" 
                            value={brushSize} 
                            onChange={(e) => setBrushSize(Number(e.target.value))}
                            className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
                        />
                         
                         {/* Undo Button */}
                         <button 
                            onClick={handleUndo} 
                            disabled={history.length === 0}
                            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            title="Step Back"
                         >
                            <Undo2 size={16} />
                         </button>

                         {/* Invert Button */}
                         <button 
                            onClick={handleInvertMask}
                            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-colors"
                            title="Invert Selection (Select Background)"
                         >
                             <ArrowLeftRight size={16} />
                         </button>

                         <button onClick={handleResetMask} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-colors" title="Clear Mask">
                            <Eraser size={16} />
                        </button>
                    </div>

                    {/* Input Bar */}
                    <div className="flex gap-2 relative">
                         {/* Aspect Ratio Selector for Editor */}
                         <div className="relative">
                            <button 
                                onClick={() => setShowRatioMenu(!showRatioMenu)}
                                className={`h-full px-3 rounded-xl border border-zinc-700/50 flex items-center gap-1.5 transition-colors ${aspectRatio ? 'bg-zinc-800 text-white' : 'bg-black/50 text-zinc-400'}`}
                                title="Output Aspect Ratio"
                            >
                                <Scan size={18} />
                                <span className="text-[10px] font-mono">{aspectRatio}</span>
                            </button>
                            {showRatioMenu && (
                                <div className="absolute bottom-full left-0 mb-2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden min-w-[80px] z-50 flex flex-col">
                                    {ASPECT_RATIOS.map((ratio) => (
                                        <button
                                            key={ratio.value}
                                            onClick={() => { setAspectRatio(ratio.value); setShowRatioMenu(false); }}
                                            className={`px-3 py-2 text-[10px] font-mono text-left hover:bg-zinc-800 transition-colors ${aspectRatio === ratio.value ? 'text-green-400 font-bold bg-zinc-800/50' : 'text-zinc-300'}`}
                                        >
                                            {ratio.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <input 
                            type="text" 
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Describe change..."
                            className="flex-1 bg-black/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:border-green-500/50 focus:outline-none placeholder-zinc-600 font-light"
                            autoFocus
                        />
                        <button 
                            onClick={handleGenerate}
                            disabled={!prompt.trim() || isGenerating}
                            className="bg-pink-500 hover:bg-pink-400 text-white disabled:opacity-50 disabled:cursor-not-allowed px-4 rounded-xl flex items-center justify-center transition-all font-medium shadow-[0_0_20px_rgba(236,72,153,0.3)]"
                        >
                            {isGenerating ? <Loader2 size={20} className="animate-spin"/> : <Rocket size={20} className="fill-current" />}
                        </button>
                    </div>
                </>
            ) : (
                /* Comparison Controls */
                <div className="flex items-center justify-between px-2 py-1">
                     <button 
                        onMouseDown={() => setShowOriginal(true)}
                        onMouseUp={() => setShowOriginal(false)}
                        onTouchStart={() => setShowOriginal(true)}
                        onTouchEnd={() => setShowOriginal(false)}
                        className="flex items-center gap-2 px-4 py-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/50 transition-colors select-none"
                    >
                        <Eye size={18} />
                        <span className="text-xs font-mono">HOLD COMPARE</span>
                    </button>

                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleDiscardResult}
                            className="p-3 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                            title="Discard"
                        >
                            <Trash size={18} />
                        </button>
                        <button 
                            onClick={() => generatedImage && onSave(generatedImage.data)}
                            className="bg-green-500 hover:bg-green-400 text-black px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(34,197,94,0.2)]"
                        >
                            <Save size={16} />
                            <span className="text-xs">KEEP NEW</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
