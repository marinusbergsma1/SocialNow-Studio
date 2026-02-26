
import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signInAnonymously, setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore/lite';
import { auth, db } from '../services/firebase';
import { ChevronRight, Loader2, AlertCircle, FlaskConical, CheckSquare, Square } from 'lucide-react';
import { BackgroundEffect } from './BackgroundEffect';

export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const syncUserProfile = async (user: any) => {
    try {
        // Fire-and-forget sync to 'ADS' collection
        // We do not await this to prevent blocking login if permissions are tight
        setDoc(doc(db, 'ADS', user.uid), {
          email: user.email || 'anonymous',
          uid: user.uid,
          lastLogin: serverTimestamp(),
          role: user.isAnonymous ? 'beta_tester' : 'user'
        }, { merge: true }).catch(err => {
            console.warn("Background profile sync failed (non-critical):", err);
        });
    } catch (e) {
        // Ignore synchronous errors in setup
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      try {
         await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      } catch (e) {
         console.warn("Persistence setting failed, continuing session-only", e);
      }
      
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await syncUserProfile(result.user);

    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user') {
          setError("Login cancelled.");
      } else {
          setError(`Google login failed: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBetaLogin = async () => {
    setError('');
    setLoading(true);
    try {
      try {
         await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      } catch (e) {
         console.warn("Persistence setting failed", e);
      }
      
      const result = await signInAnonymously(auth);
      await syncUserProfile(result.user);
      
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/admin-restricted-operation') {
          setError("Anonymous login is disabled in Firebase Console.");
      } else {
          setError(`Beta login failed: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      try {
         await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      } catch (e) { console.warn(e); }
      
      let userCredential;
      if (isRegistering) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      }
      await syncUserProfile(userCredential.user);

    } catch (err: any) {
      console.error(err);
      let msg = "Authentication failed.";
      if (err.code === 'auth/invalid-credential') msg = "Invalid credentials.";
      if (err.code === 'auth/user-not-found') msg = "User not found.";
      if (err.code === 'auth/wrong-password') msg = "Invalid password.";
      if (err.code === 'auth/email-already-in-use') msg = "Email already in use.";
      if (err.code === 'auth/weak-password') msg = "Password too weak.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 font-sans text-zinc-300 relative overflow-hidden">
      
      {/* Background Particles */}
      <BackgroundEffect />

      <div className="w-full max-w-sm z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Branding */}
        <div className="flex flex-col items-center mb-8">
           <div className="relative mb-6">
             <img 
                src="https://storage.googleapis.com/socialnow_branding/SocialNow%3AStudio.png"
                alt="SocialNow Studio"
                className="w-auto h-20 object-contain animate-float"
             />
           </div>
           <p className="text-[10px] text-zinc-500 font-mono mt-2 tracking-wider">RESTRICTED ACCESS // AUTHORIZED PERSONNEL ONLY</p>
        </div>

        {/* Google Login Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-zinc-900/80 hover:bg-zinc-800 backdrop-blur-md border border-zinc-800 hover:border-zinc-700 text-white h-12 rounded-lg font-bold text-sm tracking-wide flex items-center justify-center gap-3 transition-all mb-6 group shadow-lg"
        >
          {/* Google G Logo SVG */}
          <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-px bg-zinc-800 flex-1"></div>
          <span className="text-[10px] text-zinc-600 font-mono font-bold uppercase">Or Email Access</span>
          <div className="h-px bg-zinc-800 flex-1"></div>
        </div>

        {/* Email Form */}
        <form onSubmit={handleAuth} className="flex flex-col gap-4">
           <div className="space-y-1">
             <label className="text-[10px] font-mono font-bold text-zinc-500 uppercase ml-1">Identity (Email)</label>
             <input 
               type="email" 
               value={email}
               onChange={(e) => setEmail(e.target.value)}
               required
               className="w-full bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 focus:border-green-500/50 rounded-lg px-4 py-3 text-sm text-white outline-none transition-all placeholder-zinc-600"
               placeholder="operator@socialnow.ai"
             />
           </div>

           <div className="space-y-1">
             <label className="text-[10px] font-mono font-bold text-zinc-500 uppercase ml-1">Access Code (Password)</label>
             <input 
               type="password" 
               value={password}
               onChange={(e) => setPassword(e.target.value)}
               required
               className="w-full bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 focus:border-green-500/50 rounded-lg px-4 py-3 text-sm text-white outline-none transition-all placeholder-zinc-600"
               placeholder="••••••••"
             />
           </div>

            {/* Remember Me Checkbox */}
           <div 
             className="flex items-center gap-2 cursor-pointer group"
             onClick={() => setRememberMe(!rememberMe)}
           >
             {rememberMe ? (
                <CheckSquare size={14} className="text-green-500" />
             ) : (
                <Square size={14} className="text-zinc-600 group-hover:text-zinc-400" />
             )}
             <span className="text-[10px] font-mono text-zinc-500 group-hover:text-zinc-300 select-none">REMEMBER ME ON THIS DEVICE</span>
           </div>

           {error && (
             <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 p-3 rounded-lg font-mono">
               <AlertCircle size={14} />
               <span>{error}</span>
             </div>
           )}

           <button 
             type="submit" 
             disabled={loading}
             className="mt-2 bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed h-12 rounded-lg font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]"
           >
             {loading ? (
               <Loader2 size={16} className="animate-spin" />
             ) : (
               <>
                 {isRegistering ? 'INITIALIZE ID' : 'AUTHENTICATE'}
                 <ChevronRight size={16} />
               </>
             )}
           </button>
        </form>

        {/* Footer Toggle */}
        <div className="mt-8 text-center space-y-4">
          <button 
            type="button"
            onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
            className="text-[10px] font-mono text-zinc-500 hover:text-green-500 transition-colors uppercase tracking-widest border-b border-transparent hover:border-green-500/50 pb-0.5"
          >
            {isRegistering ? 'Return to Login' : 'Initialize New Identity'}
          </button>

          {/* Beta Test Login Button */}
          <button 
             type="button"
             onClick={handleBetaLogin}
             disabled={loading}
             className="w-full bg-zinc-900/50 hover:bg-zinc-800 backdrop-blur-sm border border-zinc-800 hover:border-zinc-600 text-zinc-500 hover:text-zinc-300 h-10 rounded-lg font-mono text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
          >
             <FlaskConical size={12} />
             Beta Test V7 Login
          </button>
        </div>
      </div>
      
      <div className="absolute bottom-6 text-[9px] font-mono text-zinc-600 z-10">
        SECURE CONNECTION ESTABLISHED
      </div>
    </div>
  );
};
