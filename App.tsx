
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { generateImage, editImageWithMask, analyzeIntent, buildContext } from './services/geminiService';
import { processFile } from './services/fileProcessor';
import { Message, ReferenceImage, GenerationMode, ContextUrl, BrandPreset, REFERENCE_CATEGORIES, CATEGORY_SLOTS, ReferenceCategory } from './types';
import { ReferenceBar } from './components/ReferenceBar';
import { ChatMessage } from './components/ChatMessage';
import { ImageEditor } from './components/ImageEditor';
import { LoginScreen } from './components/LoginScreen';
import { Timeline } from './components/Timeline';
import { ImagePreview } from './components/ImagePreview';
import { auth } from './services/firebase';
import { saveGeneratedAdBundle } from './services/storageService';
import { generateId } from './utils';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { Rocket, ImagePlus, RefreshCcw, LogOut, Square, Pencil, Plus, History, Upload, X, Reply, FileArchive } from 'lucide-react';

// Prefixes for user-scoped keys
const STORAGE_PREFIX_MESSAGES = 'socialnow_messages_';
const STORAGE_PREFIX_REFS = 'socialnow_social_refs_';
const STORAGE_PREFIX_URLS = 'socialnow_urls_v2_';
const STORAGE_PREFIX_PRESETS = 'socialnow_brand_presets_';

const ASPECT_RATIOS = [
  { label: '1:1 (Square)', value: '1:1' },
  { label: '3:4 (Portrait)', value: '3:4' },
  { label: '4:3 (Landscape)', value: '4:3' },
  { label: '9:16 (Story)', value: '9:16' },
  { label: '16:9 (Cinema)', value: '16:9' },
];

const DEFAULT_REFS: Record<string, ReferenceImage[]> = {
  "LOGO'S": [],
  "BRANDING": [],
  "PRODUCT DIENST": [],
  "INSPIRATIE": []
};

// FIX #5: Static Tailwind class map — no dynamic string interpolation.
const MODE_STYLES: Record<string, { active: string; border: string }> = {
    green: {
        active: 'bg-green-500/20 text-green-400',
        border: 'border-green-500/50',
    },
    pink: {
        active: 'bg-pink-500/20 text-pink-400',
        border: 'border-pink-500/50',
    },
};

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // App State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  // Reference State (categorized)
  const [references, setReferences] = useState<Record<string, ReferenceImage[]>>(DEFAULT_REFS);
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);

  // URL / Context State
  const [contextUrls, setContextUrls] = useState<ContextUrl[]>([]);

  // Brand Presets State
  const [brandPresets, setBrandPresets] = useState<BrandPreset[]>([]);

  const [mode, setMode] = useState<GenerationMode>('image');
  const [loading, setLoading] = useState(false);
  const [fileProcessing, setFileProcessing] = useState(false);

  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);

  const [lastPrompt, setLastPrompt] = useState('');

  // Reply State
  const [replyingToMessage, setReplyingToMessage] = useState<{ id: string, image: string } | null>(null);

  // Drag and Drop State
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const [aspectRatio, setAspectRatio] = useState<string>('3:4');

  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  // Lightbox Preview State
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // @ Autocomplete State
  const [showAtMenu, setShowAtMenu] = useState(false);
  const [atQuery, setAtQuery] = useState('');
  const [taggedRefs, setTaggedRefs] = useState<{ ref: ReferenceImage; category: string }[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // FIX #6: Debounce timer ref for localStorage saves
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (!currentUser) {
          setMessages([]);
          setReferences(DEFAULT_REFS);
          setContextUrls([]);
          setBrandPresets([]);
          setDataOwnerId(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowPlusMenu(false);
      }
    };
    if (showPlusMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPlusMenu]);

  // LOAD DATA EFFECT
  useEffect(() => {
    if (!user) return;

    const uid = user.uid;
    if (dataOwnerId === uid) return;

    setMessages([]);
    setReferences(DEFAULT_REFS);
    setContextUrls([]);
    setBrandPresets([]);

    if (user.isAnonymous) {
        setDataOwnerId(uid);
        return;
    }

    try {
        const savedMessages = localStorage.getItem(`${STORAGE_PREFIX_MESSAGES}${uid}`);
        const savedRefs = localStorage.getItem(`${STORAGE_PREFIX_REFS}${uid}`);
        const savedUrls = localStorage.getItem(`${STORAGE_PREFIX_URLS}${uid}`);
        const savedPresets = localStorage.getItem(`${STORAGE_PREFIX_PRESETS}${uid}`);

        if (savedMessages) setMessages(JSON.parse(savedMessages));
        if (savedRefs) {
            const parsed = JSON.parse(savedRefs);
            setReferences({ ...DEFAULT_REFS, ...parsed });
        }
        if (savedUrls) {
            const parsedUrls = JSON.parse(savedUrls);
            if (Array.isArray(parsedUrls) && parsedUrls.length > 0) {
                if (typeof parsedUrls[0] === 'string') {
                    setContextUrls(parsedUrls.map((u: string) => ({ url: u, isMySite: false })));
                } else {
                    setContextUrls(parsedUrls);
                }
            }
        }
        if (savedPresets) setBrandPresets(JSON.parse(savedPresets));

    } catch (e) {
        console.error("Failed to load user data", e);
    }

    setDataOwnerId(uid);
  }, [user, dataOwnerId]);

  // FIX #6: DEBOUNCED SAVE DATA EFFECT
  useEffect(() => {
    if (!user || !dataOwnerId || user.uid !== dataOwnerId || user.isAnonymous) return;

    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
        const uid = user.uid;
        try {
            localStorage.setItem(`${STORAGE_PREFIX_MESSAGES}${uid}`, JSON.stringify(messages));
            localStorage.setItem(`${STORAGE_PREFIX_REFS}${uid}`, JSON.stringify(references));
            localStorage.setItem(`${STORAGE_PREFIX_URLS}${uid}`, JSON.stringify(contextUrls));
            localStorage.setItem(`${STORAGE_PREFIX_PRESETS}${uid}`, JSON.stringify(brandPresets));
        } catch (e: any) {
            if (e?.name === 'QuotaExceededError' || e?.code === 22) {
                console.error("localStorage quota exceeded. Consider clearing old generations.");
                try {
                    const textOnlyMessages = messages.map(m =>
                        m.type === 'image' ? { ...m, content: '[image]', referencesUsed: undefined } : m
                    );
                    localStorage.setItem(`${STORAGE_PREFIX_MESSAGES}${uid}`, JSON.stringify(textOnlyMessages));
                } catch { /* truly out of space */ }
            } else {
                console.warn("Local storage error", e);
            }
        }
    }, 1500);

    return () => clearTimeout(saveTimerRef.current);
  }, [messages, references, contextUrls, brandPresets, user, dataOwnerId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const scrollToBottom = () => {
    if (mode !== 'edit') {
       setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100);
    }
  };

  const activeCategory = REFERENCE_CATEGORIES[activeCategoryIndex] as ReferenceCategory;
  const activeCategorySlots = CATEGORY_SLOTS[activeCategory];

  // --- PRESET HANDLERS ---
  const handleSaveBrandPreset = (name: string) => {
      const newPreset: BrandPreset = {
          id: generateId(),
          name,
          references: { ...references },
          urls: [...contextUrls],
          timestamp: Date.now()
      };
      setBrandPresets(prev => [...prev, newPreset]);
  };

  const handleLoadBrandPreset = (presetId: string) => {
      const preset = brandPresets.find(p => p.id === presetId);
      if (preset) {
          if (confirm(`Load "${preset.name}"? This will replace your current references.`)) {
              setReferences(preset.references);
              setContextUrls(preset.urls);
              setActiveCategoryIndex(0);
          }
      }
  };

  const handleDeleteBrandPreset = (presetId: string) => {
      if (confirm("Delete this brand style?")) {
          setBrandPresets(prev => prev.filter(p => p.id !== presetId));
      }
  };

  // --- DRAG & DROP HANDLERS ---
  const handleGlobalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isDraggingFile) setIsDraggingFile(true);
  };

  const handleGlobalDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingFile(false);
  };

  const handleGlobalDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0] as File;

        if (mode === 'edit') {
            if (file.type.startsWith('image/')) {
                handleUploadToEdit(file);
            } else {
                alert("Edit mode only supports image files.");
            }
            return;
        }
        await processAndAddFiles(file, 'chat');
    }
  };

  const processAndAddFiles = async (file: File, destination: 'chat' | 'ref') => {
      setFileProcessing(true);
      try {
          const processedFiles = await processFile(file);
          if (processedFiles.length === 0) {
              alert("No valid images found in file.");
              return;
          }
          const filesToAdd = processedFiles.slice(0, 10);
          if (processedFiles.length > 10) {
             alert(`Import limited to first 10 images from ${file.name}`);
          }

          if (destination === 'chat') {
               const newMessages: Message[] = filesToAdd.map(f => ({
                   id: generateId(),
                   role: 'user',
                   type: 'image',
                   content: f.data.replace(/^data:.*;base64,/, ''),
                   timestamp: Date.now()
               }));
               setMessages(prev => [...prev, ...newMessages]);

               // Also add to active category references
               setReferences(prev => {
                   const currentRefs = prev[activeCategory] || [];
                   const space = activeCategorySlots - currentRefs.length;
                   if (space <= 0) return prev;
                   const refsToAdd = filesToAdd.slice(0, space).map(f => ({
                       id: generateId(),
                       data: f.data
                   }));
                   return { ...prev, [activeCategory]: [...currentRefs, ...refsToAdd] };
               });
          }
          else if (destination === 'ref') {
               setReferences(prev => {
                   const currentRefs = prev[activeCategory] || [];
                   const space = activeCategorySlots - currentRefs.length;
                   if (space <= 0) return prev;
                   const refsToAdd = filesToAdd.slice(0, space).map(f => ({ id: generateId(), data: f.data }));
                   return { ...prev, [activeCategory]: [...currentRefs, ...refsToAdd] };
               });
          }
      } catch (e: any) {
          console.error("File processing failed", e);
          alert(e.message || "Failed to process file.");
      } finally {
          setFileProcessing(false);
      }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    if (mode === 'edit') {
        const file = e.target.files[0];
        if (!file.type.startsWith('image/')) {
            alert("Edit mode only accepts images.");
            e.target.value = '';
            return;
        }
        handleUploadToEdit(file);
        e.target.value = '';
        return;
    }
    const files = Array.from(e.target.files) as File[];
    for (const file of files) {
         await processAndAddFiles(file, 'ref');
    }
    e.target.value = '';
  };

  const handleChatFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      const files = Array.from(e.target.files) as File[];
      for (const file of files) {
          await processAndAddFiles(file, 'chat');
      }
      e.target.value = '';
  };

  const handleRemoveReference = (id: string) => {
    setReferences(prev => ({
        ...prev,
        [activeCategory]: (prev[activeCategory] || []).filter(r => r.id !== id)
    }));
  };

  const handleAddUrl = (url: string, isMySite: boolean) => {
      setContextUrls(prev => {
          if (prev.length >= 4) {
              alert("Maximum 4 URLs allowed.");
              return prev;
          }
          if (prev.find(u => u.url === url)) return prev;
          return [...prev, { url, isMySite }];
      });
  };

  const handleRemoveUrl = (url: string) => {
      setContextUrls(prev => prev.filter(u => u.url !== url));
  };

  const handleNextCategory = () => {
    setActiveCategoryIndex(prev => (prev + 1) % REFERENCE_CATEGORIES.length);
  };

  const handlePrevCategory = () => {
    setActiveCategoryIndex(prev => (prev - 1 + REFERENCE_CATEGORIES.length) % REFERENCE_CATEGORIES.length);
  };

  const handleUploadToEdit = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result && typeof e.target.result === 'string') {
        setEditingMessage({
            id: 'temp-edit-upload',
            role: 'model',
            type: 'image',
            content: e.target.result,
            timestamp: Date.now(),
            aspectRatio: '3:4',
            resolution: '1K'
        });
      }
    };
    reader.readAsDataURL(file as Blob);
  };

  const handleReferenceFromChat = (message: Message, category?: string) => {
    const dataUrl = message.content.startsWith('data:') ? message.content : `data:image/png;base64,${message.content}`;
    const newRef = { id: generateId(), data: dataUrl };
    const targetCategory = category || activeCategory;
    const targetSlots = CATEGORY_SLOTS[targetCategory as ReferenceCategory] || 4;

    if (mode === 'image') {
        setReferences(prev => {
            const categoryRefs = prev[targetCategory] || [];
            if (categoryRefs.length >= targetSlots) {
                alert(`Folder ${targetCategory} is full! Remove an image first.`);
                return prev;
            }
             return { ...prev, [targetCategory]: [...categoryRefs, newRef] };
        });
    } else if (mode === 'edit') {
        setEditingMessage({
            id: generateId(),
            role: 'model',
            type: 'image',
            content: dataUrl,
            timestamp: Date.now(),
            aspectRatio: '3:4'
        });
    }
  };

  const handleAddReferenceRaw = (base64: string, category: string) => {
      const dataUrl = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
      const newRef = { id: generateId(), data: dataUrl };
      const targetSlots = CATEGORY_SLOTS[category as ReferenceCategory] || 4;

      setReferences(prev => {
        const categoryRefs = prev[category] || [];
        if (categoryRefs.length >= targetSlots) {
            alert(`Folder ${category} is full!`);
            return prev;
        }
        return { ...prev, [category]: [...categoryRefs, newRef] };
      });
  };

  const handleReplyToImage = (message: Message) => {
      const content = message.content;
      const safeContent = content.startsWith('data:') ? content : `data:image/png;base64,${content}`;
      setReplyingToMessage({ id: message.id, image: safeContent });
  };

  // --- @ Autocomplete Handlers ---
  const getAllRefsFlat = () => {
      const result: { ref: ReferenceImage; category: string; label: string }[] = [];
      for (const cat of REFERENCE_CATEGORIES) {
          const refs = references[cat] || [];
          refs.forEach((r, idx) => {
              result.push({ ref: r, category: cat, label: `${cat} #${idx + 1}` });
          });
      }
      return result;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setInput(val);

      const cursorPos = e.target.selectionStart || 0;
      const textBeforeCursor = val.substring(0, cursorPos);
      const atMatch = textBeforeCursor.match(/@([^\s]*)$/);

      if (atMatch) {
          setAtQuery(atMatch[1].toLowerCase());
          setShowAtMenu(true);
      } else {
          setShowAtMenu(false);
          setAtQuery('');
      }
  };

  const handleAtSelect = (ref: ReferenceImage, category: string, label: string) => {
      const cursorPos = textareaRef.current?.selectionStart || input.length;
      const textBeforeCursor = input.substring(0, cursorPos);
      const textAfterCursor = input.substring(cursorPos);
      const atStart = textBeforeCursor.lastIndexOf('@');

      if (atStart >= 0) {
          const newInput = textBeforeCursor.substring(0, atStart) + `@${label} ` + textAfterCursor;
          setInput(newInput);
          setTaggedRefs(prev => {
              if (prev.find(t => t.ref.id === ref.id)) return prev;
              return [...prev, { ref, category }];
          });
      }

      setShowAtMenu(false);
      setAtQuery('');
      textareaRef.current?.focus();
  };

  const handleRemoveTag = (refId: string) => {
      setTaggedRefs(prev => prev.filter(t => t.ref.id !== refId));
  };

  const handleSend = async (text: string = input) => {
    if (!text.trim() || loading) return;

    // FIX #15: Show feedback when aborting a previous generation
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        setMessages(prev => [...prev, {
            id: generateId(),
            role: 'model',
            type: 'text',
            content: '⏹ Previous generation cancelled',
            timestamp: Date.now()
        }]);
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      type: 'text',
      content: text,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setLastPrompt(text);

    const lastModelMsg = [...messages].reverse().find(m => m.role === 'model' && m.type === 'image' && !m.content.includes('loading'));

    // Build categorized references
    const categorizedRefs = {
        products: (references["PRODUCT DIENST"] || []).map(r => r.data),
        inspiration: (references["INSPIRATIE"] || []).map(r => r.data),
        branding: [...(references["LOGO'S"] || []), ...(references["BRANDING"] || [])].map(r => r.data)
    };

    // Extract @ tagged refs as PRIMARY references
    const taggedRefImages = taggedRefs.map(t => t.ref.data);

    // Clean @ tags from prompt text
    let cleanPrompt = text.replace(/@[^\s]+\s?/g, '').trim();

    let finalPrompt = cleanPrompt;
    let usedContextImage: string | null = null;
    let isIteration = false;

    const allRefImages = [...categorizedRefs.products, ...categorizedRefs.inspiration, ...categorizedRefs.branding];
    const hasReferences = allRefImages.length > 0 || taggedRefImages.length > 0;

    if (replyingToMessage) {
        isIteration = true;
        usedContextImage = replyingToMessage.image;
        finalPrompt = `Using the attached reference image as the PRIMARY SOURCE and SUBJECT. Modify it based on: ${cleanPrompt}`;
    }
    else if ((lastModelMsg || hasReferences) && mode !== 'edit') {
        try {
             const analysis = await analyzeIntent(
                 cleanPrompt,
                 lastModelMsg?.promptUsed || lastPrompt,
                 !!lastModelMsg,
                 hasReferences
             );

             if (analysis.isIteration) {
                 finalPrompt = analysis.combinedPrompt;
                 isIteration = true;

                 if (lastModelMsg?.type === 'image') {
                      usedContextImage = lastModelMsg.content.startsWith('data:') ? lastModelMsg.content : `data:image/png;base64,${lastModelMsg.content}`;
                 }
             }
        } catch (e) {
             console.warn("Intent analysis failed, using raw prompt", e);
        }
    }

    setReplyingToMessage(null);
    const currentTaggedRefs = [...taggedRefs];
    setTaggedRefs([]);

    const placeholderId = generateId();
    const placeholderMsg: Message = {
      id: placeholderId,
      role: 'model',
      type: 'text',
      content: 'loading',
      timestamp: Date.now(),
      aspectRatio: aspectRatio
    };
    setMessages(prev => [...prev, placeholderMsg]);

    try {
        // Build context instructions from categorized references
        const contextInstructions = buildContext(categorizedRefs.products, categorizedRefs.inspiration, categorizedRefs.branding);

        // Build reference image array: tagged refs first (PRIMARY), then categorized
        let contextRefImages = [...taggedRefImages, ...allRefImages];
        if (usedContextImage) {
            contextRefImages = [usedContextImage, ...contextRefImages];
            if (isIteration) {
                 finalPrompt = `${finalPrompt}. IMPORTANT: You must apply the requested changes strictly to the provided reference image.`;
            }
        }

        // Add tagged ref instructions if any
        if (currentTaggedRefs.length > 0) {
            const tagDesc = currentTaggedRefs.map((t, i) => `Image ${i + 1}: ${t.category}`).join(', ');
            finalPrompt = `[TAGGED REFERENCES - USE AS PRIMARY SUBJECT]: ${tagDesc}\n\n${finalPrompt}`;
        }

        // Add categorized context if we have refs
        if (allRefImages.length > 0) {
            finalPrompt = `${contextInstructions}\n\n[SCENE DESCRIPTION]: ${finalPrompt}`;
        }

        // Add URL context
        if (contextUrls.length > 0) {
            const urlsString = contextUrls.map(u => `${u.url} (${u.isMySite ? 'MY BRAND IDENTITY' : 'Style Reference'})`).join(', ');
            finalPrompt = `CONTEXT INFO: The user provided these external links/context: ${urlsString}. Use "MY BRAND IDENTITY" links for specific product/brand tone and details. Use "Style Reference" for visual mood only.\n\n${finalPrompt}`;
        }

        const { imageBase64 } = await generateImage(finalPrompt, contextRefImages, '1K', aspectRatio, true, abortController.signal);

        if (user && !user.isAnonymous) {
            saveGeneratedAdBundle(user.uid, finalPrompt.substring(0, 30), [imageBase64], finalPrompt)
               .catch(err => console.error("Auto-save failed:", err));
        }

        setMessages(prev => prev.map(msg => {
          if (msg.id === placeholderId) {
            return { ...msg, type: 'image', content: imageBase64, promptUsed: finalPrompt, referencesUsed: contextRefImages, aspectRatio: aspectRatio };
          }
          return msg;
        }));

    } catch (error: any) {
        if (error.name === 'AbortError') {
            setMessages(prev => prev.filter(msg => msg.id !== placeholderId));
        } else {
            let errorText = error.message || "Failed to generate.";
            setMessages(prev => prev.map(msg => {
                if (msg.id === placeholderId) {
                return { ...msg, type: 'text', content: `Error: ${errorText}` };
                }
                return msg;
            }));
        }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleUpscale = async (message: Message) => {
    if (message.isUpscaling) return;
    setMessages(prev => prev.map(m => m.id === message.id ? { ...m, isUpscaling: true } : m));

    const upscaleId = generateId();
    setMessages(prev => [...prev, {
        id: upscaleId,
        role: 'model',
        type: 'text',
        content: 'loading',
        timestamp: Date.now(),
        aspectRatio: message.aspectRatio || '3:4'
    }]);

    try {
        const strictPrompt = "High fidelity upscale. Maintain exact details, colors, and composition. Do not alter the subject.";
        const { imageBase64 } = await generateImage(
            strictPrompt,
            message.content.startsWith('data:') ? [message.content] : [`data:image/png;base64,${message.content}`],
            '2K',
            message.aspectRatio || '3:4',
            true
        );

        setMessages(prev => prev.map(m => {
            if (m.id === upscaleId) {
                return { ...m, type: 'image', content: imageBase64, resolution: '2K', aspectRatio: message.aspectRatio, promptUsed: strictPrompt, isUpscaling: false };
            }
            if (m.id === message.id) {
                return { ...m, isUpscaling: false };
            }
            return m;
        }));

    } catch (e) {
        setMessages(prev => prev.filter(m => m.id !== upscaleId).map(m =>
            m.id === message.id ? { ...m, isUpscaling: false } : m
        ));
    }
  };

  const handleEditRaw = (base64: string) => {
     setEditingMessage({
         id: generateId(),
         role: 'model',
         type: 'image',
         content: base64,
         timestamp: Date.now(),
         aspectRatio: '3:4'
     });
  };

  const handleGenerateMask = async (maskBase64: string, prompt: string, ratio: string) => {
    if (!editingMessage) throw new Error("No session");
    const original = editingMessage.content;
    const result = await editImageWithMask(original, maskBase64, prompt, ratio);
    return { data: result.imageBase64, mimeType: result.mimeType };
  };

  const handleSaveEditedImage = (newImageBase64: string) => {
     setMessages(prev => [...prev, {
         id: generateId(),
         role: 'model',
         type: 'image',
         content: newImageBase64,
         timestamp: Date.now(),
         aspectRatio: '3:4',
         resolution: '1K'
     }]);
     setEditingMessage(null);
     setMode('image');
  };

  // FIX #5: DesktopNavBtn uses static class map instead of dynamic Tailwind interpolation
  const DesktopNavBtn = ({ mode: btnMode, icon, label, color }: { mode: GenerationMode; icon: React.ReactNode; label: string; color: string }) => {
      const styles = MODE_STYLES[color];
      const isActive = mode === btnMode;
      return (
          <button
            onClick={() => setMode(btnMode)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${
                isActive
                    ? `${styles.active} ${styles.border}`
                    : 'text-zinc-500 hover:text-white hover:bg-white/5 border-transparent'
            }`}
          >
              {icon}
              <span className="font-mono text-xs font-bold">{label}</span>
          </button>
      );
  };

  if (authLoading) return (
    <div className="h-screen w-screen bg-black flex flex-col items-center justify-center gap-4">
      <div className="flex items-center gap-3 text-white font-mono text-lg tracking-[0.3em] font-bold">
        {["LET'S", "GET", "SOCIAL", "NOW"].map((word, i) => (
          <span key={word} className="animate-pulse" style={{ animationDelay: `${i * 200}ms` }}>{word}</span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
        <span className="text-[9px] text-zinc-600 font-mono tracking-widest">INITIALIZING STUDIO...</span>
      </div>
    </div>
  );
  if (!user) return <LoginScreen />;

  // @ autocomplete filtered results
  const allRefsFlat = getAllRefsFlat();
  const filteredAtRefs = atQuery
    ? allRefsFlat.filter(r => r.label.toLowerCase().includes(atQuery) || r.category.toLowerCase().includes(atQuery))
    : allRefsFlat;

  return (
    <div
        className="flex h-screen w-screen bg-black text-white font-sans overflow-hidden selection:bg-green-500/30 relative"
        onDragOver={handleGlobalDragOver}
        onDragLeave={handleGlobalDragLeave}
        onDrop={handleGlobalDrop}
    >
      {fileProcessing && (
          <div className="absolute inset-0 z-[110] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-200 pointer-events-none">
              <FileArchive size={48} className="text-white mb-4 animate-bounce" />
              <h2 className="text-xl font-bold font-mono tracking-widest text-white">EXTRACTING ASSETS...</h2>
              <p className="text-xs font-mono text-zinc-400 mt-2">UNZIPPING / RENDERING PDF</p>
          </div>
      )}

      {isDraggingFile && (
          <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center border-4 border-dashed border-green-500/50 m-4 rounded-3xl pointer-events-none">
              <Upload size={48} className="text-green-500 mb-4 animate-bounce" />
              <h2 className="text-2xl font-bold font-mono tracking-widest text-white">DROP IMAGES, PDF OR ZIP</h2>
          </div>
      )}

      <div className="relative z-10 w-full h-full max-w-[2000px] mx-auto flex">
          {/* Desktop Sidebar */}
          <div className="hidden lg:flex flex-col w-72 border-r border-white/5 bg-zinc-950/50 backdrop-blur-md p-6 gap-8">
               <div className="flex items-center gap-3 cursor-pointer opacity-80 hover:opacity-100 transition-opacity" onClick={() => setShowTimeline(true)}>
                    <img src="https://storage.googleapis.com/socialnow_branding/SocialNow%20Favicon%20V6.webp" className="w-10 h-10 object-contain" alt="Logo" />
                    <div>
                        <h1 className="font-bold tracking-widest font-mono text-white">SocialNow</h1>
                        <span className="text-[9px] text-zinc-500 font-mono tracking-widest">STUDIO PRO V6</span>
                    </div>
               </div>
               <div className="flex flex-col gap-2">
                    <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-2 pl-1">Engine Mode</p>
                    <DesktopNavBtn mode="image" icon={<ImagePlus size={18}/>} label="Studio Gen" color="green" />
                    <DesktopNavBtn mode="edit" icon={<Pencil size={18}/>} label="Magic Editor" color="pink" />
               </div>
               <div className="flex-1" />
               <div className="flex flex-col gap-2 border-t border-white/5 pt-4">
                    <button onClick={() => setShowTimeline(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-colors">
                        <History size={18} />
                        <span className="font-mono text-xs">Timeline Archive</span>
                    </button>
                    <button onClick={() => signOut(auth)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <LogOut size={18} />
                        <span className="font-mono text-xs">Disconnect</span>
                    </button>
               </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col relative min-w-0 bg-zinc-900/10">
               {/* Mobile Header */}
               <header className="flex lg:hidden items-center justify-between p-4 border-b border-white/10 bg-black/60 backdrop-blur-md">
                   <div className="flex items-center gap-3">
                      <img src="https://storage.googleapis.com/socialnow_branding/SocialNow%20Favicon%20V6.webp" className="w-8 h-8 object-contain" alt="Logo" />
                      <div className="flex flex-col">
                         <h1 className="text-sm font-bold tracking-wider font-mono text-white">SocialNow</h1>
                      </div>
                   </div>
                   <div className="flex items-center gap-2">
                      <button onClick={() => setMode('image')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono transition-all border ${mode === 'image' ? 'bg-green-500/20 text-green-300 border-green-500/50' : 'text-zinc-500 border-transparent'}`}>STUDIO</button>
                      <button onClick={() => setMode('edit')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono transition-all border ${mode === 'edit' ? 'bg-pink-500/20 text-pink-300 border-pink-500/50' : 'text-zinc-500 border-transparent'}`}>EDIT</button>
                   </div>
               </header>

               {/* Mobile ReferenceBar */}
               <div className="lg:hidden">
                    {mode !== 'edit' && (
                        <ReferenceBar
                            references={references[activeCategory] || []}
                            onRemove={handleRemoveReference}
                            onAddClick={() => fileInputRef.current?.click()}
                            mode={mode}
                            maxSlots={activeCategorySlots}
                            categoryName={activeCategory}
                            onNextCategory={handleNextCategory}
                            onPrevCategory={handlePrevCategory}
                            onDropAsset={handleAddReferenceRaw}
                            layout="horizontal"
                            urls={contextUrls}
                            onAddUrl={handleAddUrl}
                            onRemoveUrl={handleRemoveUrl}
                            presets={brandPresets}
                            onSavePreset={handleSaveBrandPreset}
                            onLoadPreset={handleLoadBrandPreset}
                            onDeletePreset={handleDeleteBrandPreset}
                        />
                    )}
               </div>

               {/* Chat / Content Area */}
               <div className="flex-1 overflow-y-auto p-4 lg:p-8 scrollbar-hide relative flex flex-col">
                   <div className="max-w-4xl mx-auto w-full flex flex-col">
                       {mode === 'edit' ? (
                            <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh]">
                                <div
                                    className="group relative w-full max-w-lg aspect-[3/2] border-2 border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center gap-6 bg-zinc-900/10 hover:bg-zinc-900/30 hover:border-pink-500/30 transition-all cursor-pointer"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <div className="p-6 rounded-full bg-zinc-900 border border-zinc-800 shadow-xl group-hover:scale-110 group-hover:border-pink-500/50 transition-all">
                                        <ImagePlus size={40} className="text-zinc-500 group-hover:text-pink-500 transition-colors" strokeWidth={1.5} />
                                    </div>
                                    <div className="text-center space-y-2">
                                        <h2 className="text-lg font-bold text-white tracking-wide">Magic Editor</h2>
                                        <p className="text-xs text-zinc-500 font-mono">Upload an image to start editing</p>
                                    </div>
                                    <button className="px-6 py-2.5 bg-zinc-800 text-white rounded-lg font-mono text-xs font-bold tracking-wider group-hover:bg-pink-500 transition-colors">
                                        SELECT IMAGE
                                    </button>
                                </div>
                            </div>
                       ) : (
                           <>
                               {messages.length === 0 && (
                                 <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-700 pointer-events-none opacity-50">
                                    <ImagePlus size={64} strokeWidth={0.5} />
                                    <p className="mt-4 text-sm font-mono tracking-widest">STUDIO READY</p>
                                 </div>
                               )}
                               {messages.map((msg) => (
                                 <ChatMessage
                                    key={msg.id}
                                    message={msg}
                                    userName={user.displayName || 'USER'}
                                    onUpscale={handleUpscale}
                                    onUseReference={handleReferenceFromChat}
                                    onDelete={(id) => setMessages(prev => prev.filter(m => m.id !== id))}
                                    onEdit={(m) => setEditingMessage(m)}
                                    onReply={handleReplyToImage}
                                    onImageClick={(base64) => setPreviewImage(base64)}
                                 />
                               ))}
                               <div ref={messagesEndRef} />
                           </>
                       )}
                   </div>
               </div>

               {/* Input Area */}
               <div className="p-4 lg:p-6 bg-black/80 lg:bg-transparent backdrop-blur-md border-t border-white/10 lg:border-none relative z-20">
                    <div className="max-w-4xl mx-auto w-full">
                        {replyingToMessage && (
                            <div className="flex items-center justify-between bg-zinc-900/80 border border-green-500/30 rounded-t-lg px-3 py-2 mb-2 animate-in slide-in-from-bottom-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded overflow-hidden border border-white/10">
                                        <img src={replyingToMessage.image} alt="Reply context" className="w-full h-full object-cover" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-green-400 flex items-center gap-1">
                                            <Reply size={10} /> REPLYING TO IMAGE
                                        </p>
                                        <p className="text-[9px] text-zinc-500">Image will be leading input</p>
                                    </div>
                                </div>
                                <button onClick={() => setReplyingToMessage(null)} className="p-1 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition-colors"><X size={14} /></button>
                            </div>
                        )}

                        {/* Tagged Refs Pills */}
                        {taggedRefs.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {taggedRefs.map(t => (
                                    <div key={t.ref.id} className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 rounded-full px-2 py-0.5">
                                        <img src={t.ref.data} alt="" className="w-5 h-5 rounded-full object-cover" />
                                        <span className="text-[9px] font-mono text-green-300">{t.category}</span>
                                        <button onClick={() => handleRemoveTag(t.ref.id)} className="text-green-400 hover:text-red-400"><X size={10} /></button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center gap-2 mb-3 overflow-x-auto scrollbar-hide pb-1">
                            {mode === 'image' && (
                                <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
                                    {ASPECT_RATIOS.map(ratio => (
                                        <button key={ratio.value} onClick={() => setAspectRatio(ratio.value)} className={`px-2 py-1 rounded-md text-[9px] font-mono transition-all whitespace-nowrap ${aspectRatio === ratio.value ? 'bg-zinc-800 text-green-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>{ratio.label.split(' ')[0]}</button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className={`relative flex items-end gap-2 bg-zinc-900/50 border ${replyingToMessage ? 'border-green-500/50 bg-zinc-900' : 'border-zinc-800'} rounded-2xl p-1.5 focus-within:border-green-500/50 focus-within:bg-zinc-900 transition-all shadow-lg`}>
                            <div className="relative" ref={menuRef}>
                                <button onClick={() => setShowPlusMenu(!showPlusMenu)} className="p-3 text-zinc-400 hover:text-white bg-zinc-800 rounded-xl hover:bg-zinc-700 transition-colors"><Plus size={18} /></button>
                                {showPlusMenu && (
                                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 z-50">
                                        <button onClick={() => { editFileInputRef.current?.click(); setShowPlusMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800 transition-colors text-xs text-zinc-300"><Pencil size={14} className="text-pink-400" /><span>Magic Edit</span></button>
                                        <button onClick={() => { chatFileInputRef.current?.click(); setShowPlusMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800 transition-colors text-xs text-zinc-300 border-t border-zinc-800"><ImagePlus size={14} className="text-green-400" /><span>Upload Assets</span></button>
                                        <button onClick={() => { setShowTimeline(true); setShowPlusMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800 transition-colors text-xs text-zinc-300 border-t border-zinc-800"><History size={14} className="text-blue-400" /><span>Timeline / Archive</span></button>
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 relative">
                                <textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={handleInputChange}
                                    onKeyDown={(e) => {
                                        if (showAtMenu) {
                                            if (e.key === 'Escape') { setShowAtMenu(false); e.preventDefault(); return; }
                                        }
                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                                    }}
                                    placeholder={replyingToMessage ? "Describe changes for this image..." : mode === 'edit' ? "Select an image to start..." : "Imagine something... (use @ to reference images)"}
                                    className="w-full bg-transparent border-none outline-none text-sm text-white placeholder-zinc-500 resize-none py-3 max-h-32 min-h-[44px]"
                                    rows={1}
                                />
                                {/* @ Autocomplete Dropdown */}
                                {showAtMenu && filteredAtRefs.length > 0 && (
                                    <div className="absolute bottom-full left-0 mb-2 w-72 max-h-64 overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 animate-in slide-in-from-bottom-2">
                                        <div className="px-3 py-2 border-b border-white/5">
                                            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Select Reference Image</span>
                                        </div>
                                        {REFERENCE_CATEGORIES.map(cat => {
                                            const catRefs = filteredAtRefs.filter(r => r.category === cat);
                                            if (catRefs.length === 0) return null;
                                            return (
                                                <div key={cat}>
                                                    <div className="px-3 py-1.5 bg-zinc-800/50">
                                                        <span className="text-[8px] font-mono font-bold text-green-400 uppercase tracking-widest">{cat}</span>
                                                    </div>
                                                    {catRefs.map(item => (
                                                        <button
                                                            key={item.ref.id}
                                                            onClick={() => handleAtSelect(item.ref, item.category, item.label)}
                                                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 transition-colors"
                                                        >
                                                            <img src={item.ref.data} alt="" className="w-9 h-9 rounded-lg object-cover border border-white/10" />
                                                            <span className="text-[10px] font-mono text-zinc-300">{item.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            <button onClick={() => handleSend()} disabled={!input.trim() || loading} className={`p-3 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)] group bg-green-500 hover:bg-green-400`}>
                                {loading ? <RefreshCcw size={18} className="animate-spin" /> : <Rocket size={18} className="group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />}
                            </button>
                        </div>
                    </div>
               </div>
          </div>

          {/* Desktop Right Sidebar */}
          <div className="hidden lg:flex flex-col w-80 border-l border-white/5 bg-zinc-950/50 backdrop-blur-md">
             {mode !== 'edit' ? (
                 <ReferenceBar
                     references={references[activeCategory] || []}
                     onRemove={handleRemoveReference}
                     onAddClick={() => fileInputRef.current?.click()}
                     mode={mode}
                     maxSlots={activeCategorySlots}
                     categoryName={activeCategory}
                     onNextCategory={handleNextCategory}
                     onPrevCategory={handlePrevCategory}
                     onDropAsset={handleAddReferenceRaw}
                     layout="vertical"
                     urls={contextUrls}
                     onAddUrl={handleAddUrl}
                     onRemoveUrl={handleRemoveUrl}
                     presets={brandPresets}
                     onSavePreset={handleSaveBrandPreset}
                     onLoadPreset={handleLoadBrandPreset}
                     onDeletePreset={handleDeleteBrandPreset}
                 />
             ) : (
                 <div className="flex flex-col items-center justify-center h-full text-zinc-600 p-8 text-center gap-4">
                     <Pencil size={32} />
                     <p className="text-xs font-mono">EDITOR MODE ACTIVE</p>
                     <p className="text-[10px] text-zinc-700">References are disabled while editing to focus on the canvas.</p>
                 </div>
             )}
          </div>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*,.zip,.pdf" multiple onChange={handleFileInputChange} />
      <input type="file" ref={editFileInputRef} className="hidden" accept="image/*" onChange={(e) => { if(e.target.files?.[0]) handleUploadToEdit(e.target.files[0]); e.target.value = ''; }} />
      <input type="file" ref={chatFileInputRef} className="hidden" accept="image/*,.zip,.pdf" multiple onChange={handleChatFileUpload} />

      {editingMessage && (
          <ImageEditor
             imageBase64={editingMessage.content}
             onClose={() => setEditingMessage(null)}
             onSave={handleSaveEditedImage}
             onGenerate={handleGenerateMask}
             initialAspectRatio={editingMessage.aspectRatio}
          />
      )}

      {showTimeline && user && (
          <Timeline userId={user.uid} onClose={() => setShowTimeline(false)} />
      )}

      {previewImage && (
        <ImagePreview
            src={previewImage}
            onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
};

export default App;
