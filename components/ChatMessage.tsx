
import React, { useMemo } from 'react';
import { Message } from '../types';
import { Download, Trash2, ArrowUpCircle, Copy, ImagePlus, Edit3, Volume2, Square, Reply } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
  userName?: string;
  onUpscale: (message: Message) => void;
  onUseReference: (message: Message, category?: string) => void;
  onDelete: (id: string) => void;
  onEdit?: (message: Message) => void;
  onReply?: (message: Message) => void;
  onImageClick?: (base64: string) => void;
}

// FIX #14: Extracted as a pure function so it can be used in useMemo
const toSafeSrc = (content: string): string => {
    return content.startsWith('data:') ? content : `data:image/png;base64,${content}`;
};

export const ChatMessage: React.FC<ChatMessageProps> = ({
    message,
    userName = 'OPERATOR',
    onUpscale,
    onUseReference,
    onDelete,
    onEdit,
    onReply,
    onImageClick,
}) => {
  const [isSpeaking, setIsSpeaking] = React.useState(false);

  const isUser = message.role === 'user';
  const isImage = message.type === 'image';

  // FIX #14: Memoize the data URI so React doesn't re-render the <img> on every parent update
  const imageSrc = useMemo(() => toSafeSrc(message.content), [message.content]);

  const handleSpeak = () => {
    if (!window.speechSynthesis) return;

    if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        return;
    }

    const utterance = new SpeechSynthesisUtterance(message.content);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const ToolButton = ({ onClick, icon: Icon, title, disabled = false, color = "hover:text-white" }: any) => (
      <button
        onClick={(e) => { e.stopPropagation(); onClick && onClick(); }}
        disabled={disabled}
        className={`p-1.5 rounded-md text-zinc-500 transition-colors ${color} hover:bg-zinc-800 disabled:opacity-30`}
        title={title}
      >
        <Icon size={14} />
      </button>
  );

  return (
    <div className={`flex flex-col gap-2 mb-6 animate-in slide-in-from-bottom-2 duration-300 ${isUser ? 'items-end' : 'items-start'}`}>

        {/* Avatar / Role Label */}
        <div className={`flex items-center gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center border overflow-hidden ${isUser ? 'bg-white text-black border-white' : 'bg-black text-green-500 border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.2)]'}`}>
                {isUser ? (
                    <span className="text-[10px] font-bold">{userName.charAt(0).toUpperCase()}</span>
                ) : (
                    <img
                        src="https://storage.googleapis.com/socialnow_branding/SocialNow%20Favicon%20V6.webp"
                        alt="SocialNow"
                        className="w-4 h-4 object-contain"
                    />
                )}
            </div>
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                {isUser ? userName.toUpperCase() : 'SOCIALNOW'}
            </span>
            <span className="text-[9px] text-zinc-600 font-mono">
                {new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
        </div>

        {/* Content Bubble */}
        <div className={`
            relative max-w-[90%] md:max-w-[600px] lg:max-w-[700px] rounded-2xl p-4 overflow-hidden border transition-all
            ${isUser ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-black/40 border-white/10 text-zinc-300 backdrop-blur-md'}
        `}>
            {/* Text Content */}
            {message.type === 'text' && (
                <div className="whitespace-pre-wrap text-sm leading-relaxed font-light font-sans relative group">
                     {message.content === 'loading' ? (
                        <div className="flex items-center gap-3 font-mono text-xs">
                             <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                             <span className="text-green-500 tracking-[0.2em]">LET'S — GET — SOCIAL — NOW</span>
                        </div>
                     ) : (
                        <>
                             {message.content}
                             {!isUser && (
                                <button
                                    onClick={handleSpeak}
                                    className={`ml-2 inline-flex align-middle p-1 rounded hover:bg-white/10 transition-colors ${isSpeaking ? 'text-green-400 animate-pulse' : 'text-zinc-500'}`}
                                >
                                    {isSpeaking ? <Square size={10} fill="currentColor"/> : <Volume2 size={12}/>}
                                </button>
                             )}
                        </>
                     )}
                </div>
            )}

            {/* Image Content */}
            {isImage && (
                <div className="flex flex-col gap-2 relative">
                    <div
                        className="relative rounded-lg overflow-hidden border border-white/5 bg-black cursor-zoom-in group"
                        onClick={() => onImageClick?.(imageSrc)}
                    >
                        <img
                            src={imageSrc}
                            alt="Generated"
                            className="w-full h-auto object-contain max-h-[500px]"
                        />
                    </div>

                    {/* Action Toolbar (Below Image) */}
                    {!isUser && (
                        <div className="flex flex-wrap items-center justify-between gap-y-2 pt-1 border-t border-white/5">
                            {/* Metadata Pills */}
                            <div className="flex gap-2">
                                {message.resolution && (
                                    <span className="text-[9px] font-mono border border-white/10 px-1.5 py-0.5 rounded text-zinc-500 bg-zinc-900/50">
                                        {message.resolution}
                                    </span>
                                )}
                                {message.aspectRatio && (
                                    <span className="text-[9px] font-mono border border-white/10 px-1.5 py-0.5 rounded text-zinc-500 bg-zinc-900/50">
                                        {message.aspectRatio}
                                    </span>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1">
                                {onReply && (
                                    <ToolButton
                                        onClick={() => onReply(message)}
                                        icon={Reply}
                                        title="Reply / Edit Prompt"
                                        color="hover:text-indigo-400"
                                    />
                                )}
                                <ToolButton
                                    onClick={() => onUseReference(message)}
                                    icon={ImagePlus}
                                    title="Add to References"
                                    color="hover:text-green-400"
                                />
                                {onEdit && (
                                    <ToolButton
                                        onClick={() => onEdit(message)}
                                        icon={Edit3}
                                        title="Magic Editor"
                                        color="hover:text-pink-400"
                                    />
                                )}
                                <ToolButton
                                    onClick={() => onUpscale(message)}
                                    icon={ArrowUpCircle}
                                    title="Upscale to 2K"
                                    disabled={message.isUpscaling}
                                />
                                <a
                                    href={imageSrc}
                                    download={`SocialNow_Gen_${message.id}.png`}
                                    className="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-800 hover:text-white transition-colors"
                                    title="Download"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <Download size={14} />
                                </a>
                                <div className="w-px h-3 bg-white/10 mx-1"></div>
                                <ToolButton
                                    onClick={() => onDelete(message.id)}
                                    icon={Trash2}
                                    title="Delete"
                                    color="hover:text-red-400"
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
  );
};
