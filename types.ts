
export interface Message {
  id: string;
  role: 'user' | 'model';
  type: 'text' | 'image';
  content: string; // Text content or Base64 Image Data
  timestamp: number;

  // Image specific metadata
  resolution?: '1K' | '2K' | '4K';
  aspectRatio?: string;
  promptUsed?: string;
  referencesUsed?: string[]; // Array of base64 strings

  // State for UI
  isUpscaling?: boolean;
}

export interface ReferenceImage {
  id: string;
  data: string; // Base64
}

export interface ContextUrl {
    url: string;
    isMySite: boolean;
}

export interface BrandPreset {
  id: string;
  name: string;
  references: Record<string, ReferenceImage[]>;
  urls: ContextUrl[];
  timestamp: number;
}

export type GenerationMode = 'image' | 'edit';

export const REFERENCE_CATEGORIES = ["LOGO'S", "BRANDING", "PRODUCT DIENST", "INSPIRATIE"] as const;
export type ReferenceCategory = typeof REFERENCE_CATEGORIES[number];
export const CATEGORY_SLOTS: Record<ReferenceCategory, number> = {
  "LOGO'S": 4,
  "BRANDING": 4,
  "PRODUCT DIENST": 4,
  "INSPIRATIE": 8,
};

// FIX #13: Use a configurable const object instead of an enum with hardcoded preview names.
// Models can now be overridden via environment variables without redeploying code.
export const MODEL_CONFIG = {
  FAST_TEXT: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MODEL_FAST_TEXT) || 'gemini-3-flash-preview',
  SMART_TEXT: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MODEL_SMART_TEXT) || 'gemini-3.1-pro-preview',
  PRO_IMAGE: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MODEL_PRO_IMAGE) || 'gemini-3-pro-image-preview',
  FAST_IMAGE: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MODEL_FAST_IMAGE) || 'gemini-2.5-flash-image',
} as const;

export interface EditSession {
  originalImage: string; // Base64;
  maskImage: string | null; // Base64;
  prompt: string;
}
