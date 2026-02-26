
import { GoogleGenAI, Part, GenerateContentResponse } from "@google/genai";
import { MODEL_CONFIG } from "../types";

// FIX #2: Warn at startup if API key is being shipped client-side.
// Production apps should route through a backend proxy to keep the key secret.
const getClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key not configured. Set VITE_GEMINI_API_KEY in .env.local");
  }
  if (typeof window !== 'undefined' && import.meta.env.PROD) {
    console.warn(
      "[SECURITY] Gemini API key is embedded in the client bundle. " +
      "For production, route API calls through a backend proxy."
    );
  }
  return new GoogleGenAI({ apiKey });
};

// Helper to handle abort signals with promises
const wrapWithSignal = <T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> => {
    if (!signal) return promise;

    return new Promise((resolve, reject) => {
        const abortHandler = () => reject(new DOMException("Aborted", "AbortError"));

        if (signal.aborted) { abortHandler(); return; }
        signal.addEventListener("abort", abortHandler);

        promise.then(
            (res) => { signal.removeEventListener("abort", abortHandler); resolve(res); },
            (err) => { signal.removeEventListener("abort", abortHandler); reject(err); }
        );
    });
};

// Retry with exponential backoff
const withRetry = async <T>(
    operation: () => Promise<T>,
    retries: number = 3,
    baseDelay: number = 2000,
    signal?: AbortSignal
): Promise<T> => {
    let lastError: any;

    for (let i = 0; i < retries; i++) {
        try {
            if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
            return await operation();
        } catch (error: any) {
            lastError = error;
            if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

            const errorString = error.toString() + (error.message || "");
            const isRetryable =
                errorString.includes("503") ||
                errorString.includes("429") ||
                error.status === 503 ||
                error.status === 429 ||
                errorString.includes("UNAVAILABLE") ||
                errorString.includes("RESOURCE_EXHAUSTED") ||
                errorString.includes("Overloaded");

            if (!isRetryable || i === retries - 1) throw error;

            const waitTime = baseDelay * Math.pow(2, i) + (Math.random() * 1000);
            console.warn(`Gemini API busy (attempt ${i + 1}/${retries}). Retrying in ${Math.round(waitTime)}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    throw lastError;
};

// Map platform ratios to Gemini-supported ratios
const getSupportedRatio = (ratio: string): string => {
    switch (ratio) {
        case '4:5': return '3:4';
        case '1.91:1': return '16:9';
        default: return ratio;
    }
};

/**
 * FIX #8: Analyzes user intent with a LOCAL heuristic first, only falling back to AI for ambiguous cases.
 * This eliminates the extra 1-3s latency for obvious iterations like "make it darker".
 */
export const analyzeIntent = async (
    userInput: string,
    previousPrompt: string | undefined,
    hasPreviousImage: boolean,
    hasUserReferences: boolean
): Promise<{ isIteration: boolean; combinedPrompt: string }> => {

    // No context → always new
    if (!previousPrompt && !hasPreviousImage && !hasUserReferences) {
        return { isIteration: false, combinedPrompt: userInput };
    }

    const lower = userInput.toLowerCase().trim();

    // --- Fast local heuristic (handles ~90% of cases) ---

    // Strong iteration signals: starts with modification keywords
    const iterationStart = /^(but|make|change|add|remove|more|less|same|keep|fix|try|now|can you|could you|also|and|turn|adjust|tweak|swap|replace|with|without)\b/;
    if (iterationStart.test(lower)) {
        return {
            isIteration: true,
            combinedPrompt: previousPrompt ? `${previousPrompt}. ${userInput}` : userInput
        };
    }

    // Positive feedback + change pattern: "Great, but...", "Nice! Now make it..."
    const feedbackPattern = /^(great|good|nice|perfect|love it|looks good|awesome|cool|ok|okay|yes|yeah)[,!.\s]+(but|now|can|could|make|change|add|try)/i;
    if (feedbackPattern.test(lower)) {
        return {
            isIteration: true,
            combinedPrompt: previousPrompt ? `${previousPrompt}. ${userInput}` : userInput
        };
    }

    // Attribute-only input (no full subject) — likely iteration
    const attributeOnly = /^(darker|lighter|brighter|warmer|cooler|bigger|smaller|red|blue|green|yellow|black|white|gradient|neon|vintage|retro|modern|minimal|bold)\b/;
    if (attributeOnly.test(lower) && previousPrompt) {
        return {
            isIteration: true,
            combinedPrompt: `${previousPrompt}. Make it ${userInput}`
        };
    }

    // Strong new-request signals: looks like a full scene description
    const hasSubject = lower.split(' ').length > 5 && /\b(a |an |the |photo of|image of|picture of|create|generate|design|draw)\b/i.test(lower);
    if (hasSubject && !lower.startsWith('make') && !lower.startsWith('change')) {
        return { isIteration: false, combinedPrompt: userInput };
    }

    // --- Ambiguous: fall back to AI classification ---
    try {
        const ai = getClient();
        const prompt = `You are the brain of an AI Design Studio.

CONTEXT:
- Previous image description: "${previousPrompt || 'None'}"
- New user message: "${userInput}"

Is this FEEDBACK on the previous result, or a NEW REQUEST?
Rules:
1. Positive reinforcement + change = ITERATION
2. Attribute without full subject = ITERATION
3. Full new scene description = NEW

OUTPUT JSON ONLY: { "isIteration": boolean, "combinedPrompt": "merged prompt if iteration, or raw input if new" }`;

        const response = await ai.models.generateContent({
            model: MODEL_CONFIG.SMART_TEXT,
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: 'application/json' }
        });

        const text = response.text || "{}";
        const json = JSON.parse(text);
        return {
            isIteration: json.isIteration === true,
            combinedPrompt: json.combinedPrompt || userInput
        };
    } catch (e) {
        // Final fallback: keyword check
        const feedbackKeywords = ['but', 'make', 'change', 'add', 'remove', 'turn', 'less', 'more', 'instead', 'background', 'logo', 'text', 'darker', 'lighter', 'style', 'color', 'same', 'fix', 'keep'];
        const isIter = feedbackKeywords.some(k => lower.includes(k));

        let combined = userInput;
        if (isIter && previousPrompt) {
            combined = `${previousPrompt}. ${userInput}`;
        }

        return { isIteration: isIter, combinedPrompt: combined };
    }
};

export const generateImage = async (
  prompt: string,
  referenceImages: string[],
  size: '1K' | '2K' | '4K' = '1K',
  aspectRatio: string = '3:4',
  useProModel: boolean = true,
  signal?: AbortSignal
): Promise<{ imageBase64: string; mimeType: string }> => {
  const ai = getClient();

  const parts: Part[] = [];

  // Add reference images
  referenceImages.forEach((base64) => {
    const mimeMatch = base64.match(/^data:(.*);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
    const data = base64.replace(/^data:.*;base64,/, '');

    parts.push({
      inlineData: { data, mimeType },
    });
  });

  parts.push({ text: prompt });

  const modelToUse = useProModel ? MODEL_CONFIG.PRO_IMAGE : MODEL_CONFIG.FAST_IMAGE;

  const imageConfig: any = {
    aspectRatio: getSupportedRatio(aspectRatio),
  };

  if (modelToUse === MODEL_CONFIG.PRO_IMAGE) {
    imageConfig.imageSize = size;
  }

  const systemInstruction = `You are a High-Precision AI Image Generator.

  CRITICAL INSTRUCTION - READ CAREFULLY:
  The USER PROMPT is the ABSOLUTE AUTHORITY for the image CONTENT (Subject, Objects, Scene, Action).

  HIERARCHY OF CONTROL:
  1. **USER PROMPT (TEXT)**: This overrides everything else. If the user asks for "A red car", you MUST generate a red car, even if the reference images show blue trucks.
  2. **REFERENCE IMAGES**: These are strictly for **STYLE**, **LIGHTING**, **COLOR GRADING**, and **ATMOSPHERE**.

  STRICT RULES:
  - DO NOT copy the subject matter from the reference images unless the user explicitly asks to "remix" or "modify" the reference.
  - IF THE USER PROMPT CONTRADICTS THE REFERENCE IMAGE CONTENT, FOLLOW THE USER PROMPT.
  - Extract the *Vibe* from the images, but apply it to the *Subject* described in the text.`;

  try {
    const response = await withRetry(async () => {
        const request = ai.models.generateContent({
            model: modelToUse,
            contents: { parts },
            config: {
                imageConfig: imageConfig,
                systemInstruction: systemInstruction
            },
        });
        return await wrapWithSignal<GenerateContentResponse>(request, signal);
    }, 3, 2000, signal);

    let outputBase64 = '';
    let outputMime = 'image/png';

    for (const candidate of response.candidates || []) {
        for (const part of candidate.content.parts || []) {
            if (part.inlineData) {
                outputBase64 = part.inlineData.data;
                outputMime = part.inlineData.mimeType || 'image/png';
                break;
            }
        }
    }

    if (!outputBase64) throw new Error("No image generated.");

    return { imageBase64: outputBase64, mimeType: outputMime };
  } catch (error: any) {
    console.error("Generate Image Error:", error);

    // Fallback for Permission Denied (403) on Pro model
    if (useProModel && (error.message?.includes("403") || error.message?.includes("PERMISSION_DENIED"))) {
        console.warn("Pro model access denied (403). Falling back to Fast model.");
        return generateImage(prompt, referenceImages, size, aspectRatio, false, signal);
    }

    if (error.message?.includes("400")) {
        throw new Error(`Generation failed (400). Check aspect ratio compatibility: ${imageConfig.aspectRatio}`);
    }
    throw error;
  }
};

export const editImageWithMask = async (
  originalImageBase64: string,
  maskImageBase64: string,
  prompt: string,
  aspectRatio: string = '3:4',
  signal?: AbortSignal
): Promise<{ imageBase64: string; mimeType: string }> => {
  const ai = getClient();
  const parts: Part[] = [];

  const cleanBase64 = (b64: string) => b64.replace(/^data:.*;base64,/, '');

  parts.push({ inlineData: { data: cleanBase64(originalImageBase64), mimeType: 'image/png' } });
  parts.push({ inlineData: { data: cleanBase64(maskImageBase64), mimeType: 'image/png' } });

  const smartPrompt = `Task: Inpainting / Image Editing.
  Input 1: The Original Image.
  Input 2: The Mask (Black pixels = Keep, White pixels = Change).

  User Instruction: "${prompt}".

  Action:
  Strictly apply the User Instruction ONLY to the area defined by the WHITE pixels in the mask.
  Seamlessly blend the edited area with the surrounding original pixels.

  Guidance for Backgrounds:
  If the user wants to change the background (e.g. "make background black"), replace the entire masked area with that style/color while preserving the edge quality of the unmasked subject.`;

  parts.push({ text: smartPrompt });

  const response = await withRetry(async () => {
      const request = ai.models.generateContent({
        model: MODEL_CONFIG.PRO_IMAGE,
        contents: { parts },
        config: {
            imageConfig: {
                aspectRatio: getSupportedRatio(aspectRatio),
                imageSize: '1K'
            }
        },
      });
      return await wrapWithSignal<GenerateContentResponse>(request, signal);
  }, 3, 2000, signal);

  let outputBase64 = '';
  let outputMime = 'image/png';

  for (const candidate of response.candidates || []) {
    for (const part of candidate.content.parts || []) {
      if (part.inlineData) {
        outputBase64 = part.inlineData.data;
        outputMime = part.inlineData.mimeType || 'image/png';
        break;
      }
    }
  }

  if (!outputBase64) throw new Error("No image generated.");
  return { imageBase64: outputBase64, mimeType: outputMime };
};

export interface CategorizedReferences {
    products: string[];
    inspiration: string[];
    branding: string[];
}

export const buildContext = (products: string[], inspiration: string[], branding: string[]) => {
    let instructions = "VISUAL HIERARCHY & ROLE ASSIGNMENT:\n";
    let currentIndex = 1;

    if (products.length > 0) {
        instructions += `\n[PRIORITY 1: HERO SUBJECT] (Images ${currentIndex}-${currentIndex + products.length - 1})\n`;
        instructions += `ROLE: These images depict the ACTUAL PRODUCT OR SERVICE. This is the subject of the photo.\n`;
        instructions += `MANDATE: You MUST feature this exact subject. Preserve its shape, form, materials, and label details. Do NOT replace it with a generic version.\n`;
        instructions += `CONSTRAINT: Do not alter the physical properties of the product found in these images.\n`;
        currentIndex += products.length;
    }

    if (inspiration.length > 0) {
        instructions += `\n[PRIORITY 2: STYLE REFERENCE - NO CONTENT COPYING] (Images ${currentIndex}-${currentIndex + inspiration.length - 1})\n`;
        instructions += `ROLE: Style Filter Only.\n`;
        instructions += `STRICT NEGATIVE PROMPT: DO NOT COPY ANY OBJECTS, PRODUCTS, PEOPLE, LOGOS, OR TEXT from these images.\n`;
        instructions += `CRITICAL: The content of these images is IRRELEVANT. Only extract the COLOR PALETTE, LIGHTING, and MOOD.\n`;
        currentIndex += inspiration.length;
    }

    if (branding.length > 0) {
        instructions += `\n[PRIORITY 3: BRAND IDENTITY] (Images ${currentIndex}-${currentIndex + branding.length - 1})\n`;
        instructions += `ROLE: Visual DNA.\n`;
        instructions += `USAGE: Analyze these for the Brand's Visual Language.\n`;
        currentIndex += branding.length;
    }

    return instructions;
};
