
import JSZip from 'jszip';
import { ref, uploadBytes, getDownloadURL, uploadString } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore/lite';
import { db, storage } from './firebase';

/**
 * Helper: Converts Base64 image to optimized WebP format with resizing
 */
const convertToWebP = (base64: string, maxWidth = 1080): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > maxWidth || height > maxWidth) {
                const ratio = width / height;
                if (width > height) {
                    width = maxWidth;
                    height = width / ratio;
                } else {
                    height = maxWidth;
                    width = height * ratio;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error("Canvas context failed"));
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/webp', 0.8));
        };
        img.onerror = (e) => reject(e);
    });
};

/**
 * Bundles images and text into a zip, uploads to Firebase Storage,
 * uploads optimized WebP previews for all assets, and records metadata in Firestore.
 */
export const saveGeneratedAdBundle = async (
  userId: string,
  title: string,
  imagesBase64: string[],
  copyText: string
): Promise<string> => {
  try {
    const timestamp = Date.now();

    // 1. Convert and Upload ALL Images as WebP (Optimized for Display)
    const imageUrls: string[] = [];

    await Promise.all(imagesBase64.map(async (base64, index) => {
        try {
            const webpData = await convertToWebP(base64);
            const storagePath = `ADS/${userId}/assets/${timestamp}_asset_${index}.webp`;
            const storageRef = ref(storage, storagePath);
            await uploadString(storageRef, webpData, 'data_url');
            const url = await getDownloadURL(storageRef);
            imageUrls[index] = url;
        } catch (e) {
            console.error(`Failed to process asset ${index}`, e);
        }
    }));

    const validImageUrls = imageUrls.filter(u => !!u);
    const previewUrl = validImageUrls.length > 0 ? validImageUrls[0] : '';

    // 2. Create ZIP File (Original Quality PNGs)
    const zip = new JSZip();
    zip.file("ad_copy.txt", copyText);

    imagesBase64.forEach((base64, index) => {
      // FIX #18: Use a more robust regex that handles ALL data URL prefixes
      // (not just image/\w+ — also handles svg+xml, octet-stream, etc.)
      const cleanData = base64.replace(/^data:[^;]+;base64,/, "");
      zip.file(`asset_${index + 1}.png`, cleanData, { base64: true });
    });

    const zipBlob = await zip.generateAsync({ type: "blob" });

    // 3. Upload ZIP to Firebase Storage
    const filename = `ads_bundle_${timestamp}.zip`;
    const storagePath = `ADS/${userId}/ads/${timestamp}_${filename}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, zipBlob as Blob);
    const downloadURL = await getDownloadURL(storageRef);

    // 4. Save Record to Firestore
    const docRef = await addDoc(collection(db, `ADS/${userId}/generated_ads`), {
      title: title,
      storage_url: downloadURL,
      preview_url: previewUrl,
      images: validImageUrls,
      created_at: serverTimestamp(),
      status: 'completed',
      asset_count: validImageUrls.length,
      copy_text: copyText
    });

    console.log("Ad Bundle Saved:", docRef.id);
    return downloadURL;

  } catch (error) {
    console.error("Failed to save ad bundle:", error);
    throw error;
  }
};
