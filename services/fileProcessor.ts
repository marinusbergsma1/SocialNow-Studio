
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source for PDF.js (Using ESM CDN)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

export interface ProcessedFile {
    data: string; // base64
    name: string;
}

/**
 * Reads a File object and converts it to Base64
 */
const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result && typeof e.target.result === 'string') {
                resolve(e.target.result);
            } else {
                reject(new Error("Failed to read file"));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

/**
 * Extracts images from a ZIP file
 */
const processZip = async (file: File): Promise<ProcessedFile[]> => {
    const images: ProcessedFile[] = [];
    try {
        const zip = new JSZip();
        const contents = await zip.loadAsync(file);
        
        const filePromises: Promise<void>[] = [];

        contents.forEach((relativePath, zipEntry) => {
            if (zipEntry.dir) return;
            
            // Check for image extensions
            if (!relativePath.match(/\.(jpg|jpeg|png|webp|gif)$/i)) return;

            const promise = zipEntry.async('base64').then(b64 => {
                // Determine mime type based on extension
                let mime = 'image/png';
                if (relativePath.match(/\.jpg|\.jpeg$/i)) mime = 'image/jpeg';
                if (relativePath.match(/\.webp$/i)) mime = 'image/webp';
                
                images.push({
                    data: `data:${mime};base64,${b64}`,
                    name: zipEntry.name
                });
            });
            filePromises.push(promise);
        });

        await Promise.all(filePromises);
    } catch (e) {
        console.error("ZIP Processing Error:", e);
        throw new Error("Failed to process ZIP file.");
    }
    return images;
};

/**
 * Renders PDF pages as Images
 */
const processPdf = async (file: File): Promise<ProcessedFile[]> => {
    const images: ProcessedFile[] = [];
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for better quality
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) continue;

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            images.push({
                data: canvas.toDataURL('image/png'),
                name: `page_${i}.png`
            });
        }
    } catch (e) {
        console.error("PDF Processing Error:", e);
        throw new Error("Failed to process PDF file.");
    }
    return images;
};

/**
 * Main entry point to process any supported file
 */
export const processFile = async (file: File): Promise<ProcessedFile[]> => {
    const type = file.type;
    const name = file.name.toLowerCase();

    // 1. ZIP
    if (type.includes('zip') || name.endsWith('.zip')) {
        return await processZip(file);
    }

    // 2. PDF
    if (type.includes('pdf') || name.endsWith('.pdf')) {
        return await processPdf(file);
    }

    // 3. Image (Standard)
    if (type.startsWith('image/')) {
        const base64 = await readFileAsBase64(file);
        return [{ data: base64, name: file.name }];
    }

    throw new Error(`Unsupported file type: ${type}`);
};
