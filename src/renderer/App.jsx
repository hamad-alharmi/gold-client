import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import useStore from './store/useStore';
import TitleBar  from './components/TitleBar';
import Sidebar   from './components/Sidebar';
import Home      from './pages/Home';
import Instances from './pages/Instances';
import Mods      from './pages/Mods';
import Settings  from './pages/Settings';
import Login     from './pages/Login';
import Console   from './pages/Console';

const gc = window.goldClient;

export default function App() {
  const {
    auth, setAuth, setSettings, setInstances, setIsMaximized,
    setInstanceRunning,
    setInstanceLaunching,
    clearInstanceState,
    setLaunchProgress,
    appendGameLog,
  } = useStore();

  const [loading, setLoading] = useState(true);

  // ── Bootstrap ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setAuth(await gc.auth.getProfile());
        setSettings(await gc.settings.get());
        setInstances(await gc.instances.list());
      } catch (err) {
        console.error('Init error:', err);
        toast.error('Failed to initialize launcher');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Window maximize ──────────────────────────────────────────────
  useEffect(() => gc.app.onMaximized(setIsMaximized), []);

  // ── Auth events ──────────────────────────────────────────────
  useEffect(() => {
    const u1 = gc.auth.onTokenRefreshed((p) => setAuth(p));
    const u2 = gc.auth.onSessionExpired(() => {
      setAuth(null);
      toast.error('Your Microsoft session expired. Please log in again.');
    });
    return () => { u1(); u2(); };
  }, []);

  // ── Launcher events ─────────────────────────────────────────
  useEffect(() => {
    // Download/asset progress during launch
    const u1 = gc.launcher.onProgress((data) => {
      setLaunchProgress(data.instanceId, {
        message: data.message,
        percent: data.percent,
        type:    data.type,
      });
    });

    // Game log lines → Console tab
    const u2 = gc.launcher.onLog((data) => {
      appendGameLog(data.instanceId, data.line);
    });

    // Game confirmed started (first output received)
    // setInstanceRunning clears launchingInstances automatically
    const u3 = gc.launcher.onGameStart((data) => {
      setInstanceRunning(data.instanceId, true);
      toast.success('Minecraft launched!', { icon: '🎮' });
    });

    // Game exited
    const u4 = gc.launcher.onGameClose((data) => {
      // setInstanceRunning(false) clears both running and launching
      setInstanceRunning(data.instanceId, false);

      // Only show "unexpected close" toast for non-zero, non-null codes
      // and only if the game was actually running (not a failed launch)
      if (data.code !== 0 && data.code !== null) {
        toast.error(
          `"${data.instanceId}" closed with code ${data.code}. Check Console for details.`,
          { duration: 5000 }
        );
      }
    });

    // Explicit launch error forwarded from main process
    // (e.g. Java not found, version files corrupted)
    const u5 = gc.launcher.onError((data) => {
      // Clear everything — button must return to idle
      clearInstanceState(data.instanceId);
      toast.error(data.message, {
        duration: 10000,
        style: { whiteSpace: 'pre-line', maxWidth: '440px' },
      });
    });

    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, []);

  // ── Loading screen ───────────────────────────────────────────
  if (loading) return (
    <div className="flex h-screen w-screen items-center justify-center bg-dark-950">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-2xl border-2 border-gold-500/30 animate-spin-slow" />
          <div className="absolute inset-2 rounded-xl bg-gold-gradient flex items-center justify-center shadow-gold">
            <span className="font-display text-2xl font-bold text-dark-950">G</span>
          </div>
        </div>
        <div className="flex gap-1.5">
          {[0,1,2].map(i => (
            <motion.div key={i} className="w-2 h-2 rounded-full bg-gold-500"
              animate={{scale:[1,1.5,1],opacity:[0.4,1,0.4]}}
              transition={{duration:0.8,delay:i*0.2,repeat:Infinity}} />
          ))}
        </div>
      </div>
    </div>
  );

  // ── Auth gate ───────────────────────────────────────────────
  if (!auth?.username) return (
    <div className="flex flex-col h-screen bg-dark-950 overflow-hidden">
      <TitleBar /><Login />
    </div>
  );

  // ── Main app ────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-dark-950 overflow-hidden">
      <TitleBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-hidden">
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/"          element={<Page><Home /></Page>} />
              <Route path="/instances" element={<Page><Instances /></Page>} />
              <Route path="/mods"      element={<Page><Mods /></Page>} />
              <Route path="/settings"  element={<Page><Settings /></Page>} />
              <Route path="/console"   element={<Page><Console /></Page>} />
              <Route path="*"          element={<Navigate to="/" replace />} />
            </Routes>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function Page({ children }) {
  return (
    <motion.div className="h-full"
      initial={{opacity:0,x:12}} animate={{opacity:1,x:0}}
      exit={{opacity:0,x:-12}} transition={{duration:0.22,ease:'easeOut'}}>
      {children}
    </motion.div>
  );
}
