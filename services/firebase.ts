
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, deleteDoc } from "firebase/firestore/lite";
import { getStorage } from "firebase/storage";

// FIX #1: Firebase config now reads from environment variables.
// Create a .env.local file with these values:
//   VITE_FIREBASE_API_KEY=AIzaSy...
//   VITE_FIREBASE_AUTH_DOMAIN=gen-lang-client-...
//   VITE_FIREBASE_PROJECT_ID=gen-lang-client-...
//   VITE_FIREBASE_STORAGE_BUCKET=gen-lang-client-...
//   VITE_FIREBASE_MESSAGING_SENDER_ID=919...
//   VITE_FIREBASE_APP_ID=1:919...
//   VITE_FIREBASE_MEASUREMENT_ID=G-BQQ...
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ""
};

// Validate that config is present
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error(
    "Firebase config is missing. Create a .env.local file with your Firebase credentials. " +
    "See firebase.ts for required VITE_FIREBASE_* variables."
  );
}

// Initialize Firebase Core
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Helper to delete generated ads from Firestore
export const deleteGeneratedAd = async (userId: string, adId: string) => {
  try {
    const adRef = doc(db, 'ADS', userId, 'generated_ads', adId);
    await deleteDoc(adRef);
  } catch (error) {
    console.error("Error deleting ad:", error);
    throw error;
  }
};
