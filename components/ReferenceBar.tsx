
import React, { useState } from 'react';
import { ReferenceImage, GenerationMode, ContextUrl, BrandPreset } from '../types';
import { X, Plus, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, FolderOpen, Globe, Link as LinkIcon, Trash2, Home, Book, Save, Check } from 'lucide-react';

interface ReferenceBarProps {
  references: ReferenceImage[];
  onRemove: (id: string) => void;
  onAddClick: () => void;
  mode: GenerationMode;
  maxSlots?: number;
  categoryName?: string;
  onNextCategory?: () => void;
  onPrevCategory?: () => void;
  onDropAsset?: (base64: string, category: string) => void;
  layout?: 'horizontal' | 'vertical';
  urls?: ContextUrl[];
  onAddUrl?: (url: string, isMySite: boolean) => void;
  onRemoveUrl?: (url: string) => void;

  // Preset Props
  presets?: BrandPreset[];
  onSavePreset?: (name: string) => void;
  onLoadPreset?: (presetId: string) => void;
  onDeletePreset?: (presetId: string) => void;
}

export const ReferenceBar: React.FC<ReferenceBarProps> = ({
  references,
  onRemove,
  onAddClick,
  mode,
  maxSlots = 4,
  categoryName,
  onNextCategory,
  onPrevCategory,
  onDropAsset,
  layout = 'horizontal',
  urls = [],
  onAddUrl,
  onRemoveUrl,
  presets = [],
  onSavePreset,
  onLoadPreset,
  onDeletePreset
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isMySiteInput, setIsMySiteInput] = useState(false);

  // Preset UI State
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  const slots = Array.from({ length: maxSlots }, (_, i) => i);
  const isVertical = layout === 'vertical';
  const hasCategories = !!onNextCategory && !!onPrevCategory;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    const base64Data = e.dataTransfer.getData("text/plain");
    if (base64Data && onDropAsset) {
        const category = categoryName || 'REFERENCE IMAGES';
        onDropAsset(base64Data, category);
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (urlInput.trim() && onAddUrl) {
          onAddUrl(urlInput.trim(), isMySiteInput);
          setUrlInput('');
          setIsMySiteInput(false);
      }
  };

  const handlePresetSaveSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (newPresetName.trim() && onSavePreset) {
          onSavePreset(newPresetName.trim());
          setNewPresetName('');
          setIsSavingPreset(false);
      }
  };

  // --- Vertical Layout (PC Sidebar) ---
  if (isVertical) {
      return (
        <div className="flex flex-col h-full bg-zinc-950/30 p-4 border-b border-white/5 lg:border-none gap-4">

            {/* BRAND PRESETS SECTION */}
            {onSavePreset && (
                <div className="bg-zinc-900/50 rounded-xl p-3 border border-white/5 space-y-3">
                    <div className="flex items-center justify-between text-zinc-400">
                        <div className="flex items-center gap-2">
                             <Book size={14} className="text-green-400" />
                             <span className="text-[10px] font-mono font-bold tracking-widest uppercase">BRAND KITS</span>
                        </div>
                    </div>

                    {!isSavingPreset ? (
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <select
                                    onChange={(e) => onLoadPreset && onLoadPreset(e.target.value)}
                                    className="w-full bg-zinc-900 border border-zinc-700 text-zinc-300 text-[10px] rounded-lg px-2 py-2 appearance-none focus:outline-none focus:border-green-500 font-mono"
                                    defaultValue=""
                                >
                                    <option value="" disabled>Select House Style...</option>
                                    {presets.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                            </div>
                            <button
                                onClick={() => setIsSavingPreset(true)}
                                className="p-2 bg-zinc-800 hover:bg-green-500 hover:text-white text-zinc-400 rounded-lg transition-colors"
                                title="Save current setup as preset"
                            >
                                <Save size={14} />
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handlePresetSaveSubmit} className="flex gap-2 animate-in slide-in-from-right duration-200">
                            <input
                                type="text"
                                value={newPresetName}
                                onChange={(e) => setNewPresetName(e.target.value)}
                                placeholder="Style Name..."
                                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-[10px] text-white focus:outline-none focus:border-green-500 font-mono"
                                autoFocus
                            />
                            <button type="submit" className="p-1.5 bg-green-500 hover:bg-green-400 text-white rounded-lg">
                                <Check size={14} />
                            </button>
                            <button type="button" onClick={() => setIsSavingPreset(false)} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg">
                                <X size={14} />
                            </button>
                        </form>
                    )}

                    {/* Preset List (Small) for Deletion */}
                    {presets.length > 0 && !isSavingPreset && (
                         <div className="max-h-20 overflow-y-auto scrollbar-hide flex flex-col gap-1">
                             {presets.map(p => (
                                 <div key={p.id} className="group flex items-center justify-between px-2 py-1 hover:bg-white/5 rounded">
                                     <span className="text-[9px] text-zinc-500 font-mono truncate">{p.name}</span>
                                     <button
                                        onClick={(e) => { e.stopPropagation(); onDeletePreset && onDeletePreset(p.id); }}
                                        className="text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                     >
                                         <Trash2 size={10} />
                                     </button>
                                 </div>
                             ))}
                         </div>
                    )}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2 text-zinc-400">
                    <FolderOpen size={14} />
                    <span className="text-[10px] font-mono font-bold tracking-widest uppercase">
                        {categoryName || 'Active References'}
                    </span>
                 </div>
                 <span className="text-[9px] font-mono text-zinc-600 border border-white/10 px-1.5 rounded">
                    {references.length}/{maxSlots}
                 </span>
            </div>

            {/* Category Navigation (Desktop) */}
            {hasCategories && (
                <div className="flex items-center justify-between bg-zinc-900 rounded-lg p-1 mb-1 border border-zinc-800">
                    <button
                        onClick={onPrevCategory}
                        className="p-1.5 hover:bg-zinc-800 text-zinc-500 hover:text-white rounded-md transition-colors"
                    >
                        <ChevronLeft size={14} />
                    </button>
                    <span className="text-[9px] font-mono font-bold text-green-400 truncate px-2">
                        {categoryName}
                    </span>
                    <button
                        onClick={onNextCategory}
                        className="p-1.5 hover:bg-zinc-800 text-zinc-500 hover:text-white rounded-md transition-colors"
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>
            )}

            {/* Drop Zone / Grid */}
            <div
                className={`overflow-y-auto flex-1 max-h-[40vh] ${isDraggingOver ? 'bg-green-500/10 border-green-500/30' : ''} transition-colors rounded-xl border border-transparent`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div className="grid grid-cols-2 gap-3">
                    {slots.map((index) => {
                        const ref = references[index];
                        return (
                            <div
                                key={index}
                                className={`
                                    relative aspect-[4/5] rounded-xl border transition-all duration-300
                                    ${ref ? 'border-zinc-700 bg-zinc-900 shadow-lg' : 'border-white/5 border-dashed bg-white/5 hover:bg-white/10 hover:border-white/20'}
                                    group
                                `}
                            >
                                {ref ? (
                                    <>
                                        <img
                                            src={ref.data}
                                            alt="Ref"
                                            className="w-full h-full object-cover rounded-xl"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end p-1.5 rounded-xl">
                                             <button
                                                onClick={() => onRemove(ref.id)}
                                                className="bg-black/80 text-white p-1 rounded-full hover:bg-red-500 transition-colors"
                                             >
                                                 <X size={10} />
                                             </button>
                                        </div>
                                    </>
                                ) : (
                                    <button
                                        onClick={onAddClick}
                                        className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-600 hover:text-white transition-colors"
                                    >
                                        <Plus size={18} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* URL / External Context Section */}
            {onAddUrl && (
                <div className="border-t border-white/5 pt-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-zinc-400">
                            <Globe size={14} />
                            <span className="text-[10px] font-mono font-bold tracking-widest uppercase">
                                External Context
                            </span>
                        </div>
                        <span className="text-[9px] font-mono text-zinc-600 border border-white/10 px-1.5 rounded">
                            {urls.length}/4
                        </span>
                    </div>

                    <form onSubmit={handleUrlSubmit} className="flex flex-col gap-2 mb-3">
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <LinkIcon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                <input
                                    type="text"
                                    value={urlInput}
                                    onChange={(e) => setUrlInput(e.target.value)}
                                    placeholder="https://brand.com..."
                                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-2 py-2 text-[10px] text-zinc-200 focus:outline-none focus:border-green-500/50 placeholder-zinc-600 font-mono"
                                />
                            </div>
                            <button type="submit" disabled={urls.length >= 4} className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg transition-colors disabled:opacity-50">
                                <Plus size={14} />
                            </button>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer group">
                             <input
                                type="checkbox"
                                checked={isMySiteInput}
                                onChange={(e) => setIsMySiteInput(e.target.checked)}
                                className="w-3 h-3 rounded border-zinc-700 bg-zinc-900 text-green-500 focus:ring-0 focus:ring-offset-0"
                             />
                             <span className="text-[9px] text-zinc-500 group-hover:text-zinc-300 font-mono">
                                Use as My Site (Extract Brand Identity)
                             </span>
                        </label>
                    </form>

                    {/* URL List */}
                    <div className="flex flex-col gap-2 max-h-32 overflow-y-auto scrollbar-hide">
                        {urls.map((item, idx) => (
                            <div key={idx} className={`flex items-center justify-between border rounded-md px-2 py-1.5 group ${item.isMySite ? 'bg-green-500/10 border-green-500/30' : 'bg-zinc-900/50 border-white/5'}`}>
                                <div className="flex items-center gap-2 overflow-hidden">
                                    {item.isMySite ? (
                                        <Home size={10} className="text-green-400 shrink-0" />
                                    ) : (
                                        <Globe size={10} className="text-zinc-500 shrink-0" />
                                    )}
                                    <span className={`text-[9px] font-mono truncate ${item.isMySite ? 'text-green-200' : 'text-zinc-400'}`}>
                                        {item.url}
                                    </span>
                                </div>
                                {onRemoveUrl && (
                                    <button
                                        onClick={() => onRemoveUrl(item.url)}
                                        className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <X size={10} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-auto text-center px-4">
                <p className="text-[9px] text-zinc-600 font-mono leading-relaxed">
                    DRAG & DROP FILES<br/>IMAGES, ZIP, OR PDF
                </p>
            </div>
        </div>
      );
  }

  // --- Horizontal Layout (Mobile) ---
  return (
    <div className="flex flex-col border-b border-white/10 bg-black/80 backdrop-blur-sm transition-all duration-500">

        {/* Toggle Header */}
        <div
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-between px-4 py-3 cursor-pointer group/header hover:bg-white/5 transition-colors border-b border-white/5"
        >
             <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase transition-colors text-green-400">
                    {categoryName || 'REFERENCES'}
                </span>
                <span className="text-[9px] text-zinc-600 font-mono bg-zinc-900/80 px-1.5 py-0.5 rounded border border-white/5">
                    {references.length} / {maxSlots}
                </span>
             </div>

             <div className="flex items-center gap-3">
                 {/* Mobile Preset Button */}
                 {onSavePreset && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowPresetMenu(!showPresetMenu); }}
                        className="text-zinc-500 hover:text-green-400"
                    >
                        <Book size={16} />
                    </button>
                 )}
                 <button className="text-zinc-600 group-hover/header:text-white transition-colors">
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                 </button>
             </div>
        </div>

        {/* Mobile Preset Menu */}
        {showPresetMenu && onSavePreset && (
            <div className="px-4 py-3 bg-zinc-900 border-b border-white/5 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2 mb-2">
                    <select
                        onChange={(e) => { onLoadPreset && onLoadPreset(e.target.value); setShowPresetMenu(false); }}
                        className="flex-1 bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] rounded-lg px-2 py-2"
                        defaultValue=""
                    >
                        <option value="" disabled>Load Brand Kit...</option>
                        {presets.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    <button onClick={() => {
                        const name = window.prompt("Name your Brand Style:");
                        if (name && onSavePreset) onSavePreset(name);
                    }} className="p-2 bg-green-500 text-white rounded-lg">
                        <Save size={14} />
                    </button>
                </div>
            </div>
        )}

        {/* Expandable Content */}
        {isExpanded && (
            <div
                className={`p-4 pt-4 animate-in slide-in-from-top-2 duration-300 transition-colors ${isDraggingOver ? 'bg-green-500/10' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div className="flex items-center gap-1">

                  {/* Left Arrow */}
                  <div className={`
                     transition-all duration-500 ease-in-out overflow-hidden flex justify-center
                     ${hasCategories ? 'w-8 opacity-100' : 'w-0 opacity-0'}
                  `}>
                     <button
                        onClick={(e) => { e.stopPropagation(); onPrevCategory && onPrevCategory(); }}
                        className="p-2 rounded-full text-zinc-500 hover:text-green-400 hover:bg-green-500/10 transition-colors"
                      >
                        <ChevronLeft size={20} />
                      </button>
                  </div>

                  {/* Grid Container */}
                  <div className="flex-1 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]">
                     <div className="flex flex-wrap gap-3 w-full justify-center">
                        {slots.map((index) => {
                          const ref = references[index];
                          return (
                            <div
                              key={index}
                              className={`
                                relative aspect-[4/5] rounded-lg border transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] w-[calc(25%-9px)]
                                ${ref ? 'border-zinc-600 bg-zinc-900' : 'border-white/5 border-dashed bg-transparent hover:border-green-500/50 hover:bg-green-500/5'}
                                ${isDraggingOver ? 'border-green-500/50 bg-green-500/5' : ''}
                                origin-center group
                              `}
                            >
                              {ref ? (
                                <>
                                  <img
                                    src={ref.data}
                                    alt="Reference"
                                    className="w-full h-full object-cover rounded-lg opacity-80 group-hover:opacity-100 transition-opacity"
                                  />
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onRemove(ref.id); }}
                                    className="absolute -top-1.5 -right-1.5 bg-black text-white hover:text-red-400 border border-zinc-600 p-1 rounded-full shadow-lg transition-colors z-10 scale-90 hover:scale-100"
                                  >
                                    <X size={12} />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={(e) => { e.stopPropagation(); onAddClick(); }}
                                  className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-1 text-zinc-600 hover:text-green-400 transition-colors cursor-pointer"
                                  type="button"
                                  aria-label="Add Reference Image"
                                >
                                  <Plus
                                    size={20}
                                    strokeWidth={1.5}
                                    className="transition-all duration-500 group-hover:scale-110 opacity-60 group-hover:opacity-100"
                                  />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                  </div>

                  {/* Right Arrow */}
                  <div className={`
                     transition-all duration-500 ease-in-out overflow-hidden flex justify-center
                     ${hasCategories ? 'w-8 opacity-100' : 'w-0 opacity-0'}
                  `}>
                      <button
                        onClick={(e) => { e.stopPropagation(); onNextCategory && onNextCategory(); }}
                        className="p-2 rounded-full text-zinc-500 hover:text-green-400 hover:bg-green-500/10 transition-colors"
                      >
                        <ChevronRight size={20} />
                      </button>
                  </div>

                </div>
            </div>
        )}
      </div>
  );
};
