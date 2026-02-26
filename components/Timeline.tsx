
import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore/lite';
import { db, deleteGeneratedAd } from '../services/firebase';
import { Download, Clock, Image as ImageIcon, FileText, ChevronRight, Trash2, ChevronLeft, X } from 'lucide-react';

interface TimelineItem {
  id: string;
  title: string;
  storage_url: string;
  preview_url?: string;
  images?: string[];
  created_at: any;
  asset_count: number;
}

interface TimelineProps {
  userId: string;
  onClose: () => void;
}

export const Timeline: React.FC<TimelineProps> = ({ userId, onClose }) => {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    // Fetch from 'ADS' collection
    const q = query(
      collection(db, 'ADS', userId, 'generated_ads'),
      orderBy('created_at', 'desc'),
      limit(50)
    );

    getDocs(q).then((snapshot) => {
        const ads = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as TimelineItem[];
        
        setItems(ads);
        setLoading(false);
    }).catch(err => {
        console.error("Failed to fetch timeline", err);
        setLoading(false);
    });

  }, [userId]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if(window.confirm("Are you sure you want to delete this archive?")) {
          await deleteGeneratedAd(userId, id);
          setItems(prev => prev.filter(item => item.id !== id));
      }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp || typeof timestamp.toDate !== 'function') return { date: 'Syncing...', time: '' };
    const date = timestamp.toDate();
    return {
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    };
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm lg:backdrop-blur-md flex justify-end animate-in fade-in duration-300">
      
      {/* Click outside to close (PC) */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Drawer Panel */}
      <div className="relative w-full lg:w-[600px] h-full bg-black lg:bg-zinc-950/95 lg:border-l lg:border-white/10 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
          
          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/10 bg-black/50 backdrop-blur-sm sticky top-0 z-20">
            <div>
               <h2 className="text-lg md:text-xl font-mono font-bold text-white tracking-widest flex items-center gap-2">
                 <Clock size={18} className="text-indigo-400" />
                 TIMELINE
               </h2>
               <p className="text-[9px] md:text-[10px] text-zinc-500 font-mono mt-0.5 md:mt-1">CLOUD ARCHIVE & ASSET GALLERY</p>
            </div>
            <button 
              onClick={onClose}
              className="flex items-center gap-1 p-2 bg-zinc-900/50 rounded-lg text-[10px] font-mono text-zinc-400 hover:text-white transition-colors"
            >
              CLOSE <X size={12} />
            </button>
          </div>

          {/* Grid Content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-hide">
            {loading ? (
                <div className="flex items-center justify-center h-40">
                    <span className="text-zinc-500 font-mono text-xs animate-pulse">SYNCING DATABASE...</span>
                </div>
            ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-4">
                    <div className="w-16 h-16 rounded-2xl border border-zinc-800 flex items-center justify-center bg-zinc-900/50">
                        <FileText size={24} />
                    </div>
                    <p className="font-mono text-xs">NO ARCHIVES FOUND</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-2 gap-3 md:gap-4 pb-20">
                    {items.map((item) => (
                        <TimelineCard key={item.id} item={item} onDelete={handleDelete} formatDate={formatDate} />
                    ))}
                </div>
            )}
          </div>
      </div>
    </div>
  );
};

const TimelineCard: React.FC<{
    item: TimelineItem, 
    onDelete: (id: string, e: React.MouseEvent) => void,
    formatDate: (ts: any) => { date: string, time: string }
}> = ({ item, onDelete, formatDate }) => {
    
    const displayImages = item.images && item.images.length > 0 
        ? item.images 
        : item.preview_url ? [item.preview_url] : [];
        
    const [currentIndex, setCurrentIndex] = useState(0);
    const { date, time } = formatDate(item.created_at);

    // Swipe State
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

    const handleNext = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentIndex(prev => (prev + 1) % displayImages.length);
    };

    const handlePrev = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentIndex(prev => (prev - 1 + displayImages.length) % displayImages.length);
    };

    // Swipe Handlers (Unified mouse/touch)
    const onTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
        setTouchEnd(null);
        if ('touches' in e) {
            setTouchStart(e.targetTouches[0].clientX);
        } else {
            setTouchStart((e as React.MouseEvent).clientX);
        }
    };

    const onTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
        if ('touches' in e) {
            setTouchEnd(e.targetTouches[0].clientX);
        } else {
            if ((e as React.MouseEvent).buttons === 1) {
                setTouchEnd((e as React.MouseEvent).clientX);
            }
        }
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const minSwipeDistance = 50;
        
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) setCurrentIndex(prev => (prev + 1) % displayImages.length);
        if (isRightSwipe) setCurrentIndex(prev => (prev - 1 + displayImages.length) % displayImages.length);
        
        setTouchStart(null);
        setTouchEnd(null);
    };

    return (
        <div className="group relative bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden hover:border-indigo-500/50 transition-all duration-300 flex flex-col select-none">
            {/* Preview Area */}
            <div 
                className="relative aspect-[4/5] bg-black overflow-hidden group/image cursor-grab active:cursor-grabbing select-none"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onMouseDown={onTouchStart}
                onMouseMove={onTouchMove}
                onMouseUp={onTouchEnd}
                onMouseLeave={() => { setTouchStart(null); setTouchEnd(null); }}
            >
                {displayImages.length > 0 ? (
                    <img 
                        src={displayImages[currentIndex]} 
                        alt={`${item.title}`} 
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500 pointer-events-none select-none"
                        draggable={false}
                        loading="lazy"
                        decoding="async"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-950">
                        <ImageIcon size={32} className="text-zinc-800" />
                    </div>
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity pointer-events-none"></div>
                
                {displayImages.length > 1 && (
                    <>
                        <button onClick={handlePrev} className="absolute left-1 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 hover:bg-white text-white hover:text-black rounded-full backdrop-blur-sm opacity-0 group-hover/image:opacity-100 transition-all z-10">
                            <ChevronLeft size={14} />
                        </button>
                        <button onClick={handleNext} className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 hover:bg-white text-white hover:text-black rounded-full backdrop-blur-sm opacity-0 group-hover/image:opacity-100 transition-all z-10">
                            <ChevronRight size={14} />
                        </button>
                        <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-1 pointer-events-none">
                            {displayImages.map((_, idx) => (
                                <div key={idx} className={`w-1 h-1 rounded-full ${idx === currentIndex ? 'bg-white' : 'bg-white/30'}`} />
                            ))}
                        </div>
                    </>
                )}

                <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/50 backdrop-blur border border-white/10 rounded text-[8px] font-mono text-zinc-300 pointer-events-none">
                    {displayImages.length > 0 ? `${currentIndex + 1}/${displayImages.length}` : '0'} ASSETS
                </div>
                
                <button 
                    onClick={(e) => onDelete(item.id, e)}
                    className="absolute top-2 left-2 p-1.5 bg-black/50 hover:bg-red-500/80 hover:text-white backdrop-blur border border-white/10 hover:border-red-500 rounded text-zinc-400 opacity-0 group-hover:opacity-100 transition-all duration-200"
                >
                    <Trash2 size={12} />
                </button>
            </div>

            <div className="p-3 bg-zinc-900 border-t border-white/5 flex flex-col gap-1.5">
                <div>
                    <h3 className="text-xs font-bold text-white truncate font-mono">{item.title}</h3>
                    <p className="text-[9px] text-zinc-500 font-mono mt-0.5">{date}</p>
                </div>
                
                <a 
                    href={item.storage_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 flex items-center justify-center gap-2 w-full py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-md text-[10px] font-bold font-mono transition-colors"
                >
                    <Download size={10} />
                    ZIP DOWNLOAD
                </a>
            </div>
        </div>
    );
};
