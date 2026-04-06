import React from 'react';
import { motion } from 'framer-motion';
import { Play, Square, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import useStore from '../store/useStore';
const gc = window.goldClient;

export default function LaunchButton({ instance, size = 'md' }) {
  const { runningInstances, launchProgress } = useStore();
  const isRunning   = runningInstances.has(instance.id);
  const progress    = launchProgress[instance.id];
  const isLaunching = progress && !isRunning;
  const sizes = { sm:{btn:'px-3 py-1.5 text-xs gap-1.5',icon:12}, md:{btn:'px-4 py-2 text-sm gap-2',icon:14}, lg:{btn:'px-6 py-3 text-base gap-2.5',icon:16} };
  const s = sizes[size] || sizes.md;

  async function handleLaunch() {
    if (isRunning) {
      if (!window.confirm(`Stop "${instance.name}"?`)) return;
      try { await gc.launcher.kill(instance.id); toast('Game stopped', { icon:'⏹️' }); } catch (err) { toast.error(err.message); }
      return;
    }
    if (isLaunching) return;
    try { await gc.launcher.launch(instance.id); } catch (err) { toast.error(`Launch failed: ${err.message}`); }
  }

  return (
    <motion.button onClick={handleLaunch} whileTap={{scale:0.96}} disabled={isLaunching}
      className={`relative inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 overflow-hidden select-none ${s.btn} ${isRunning ? 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20' : isLaunching ? 'bg-gold-500/20 border border-gold-500/30 text-gold-400 cursor-wait' : 'bg-gold-gradient text-dark-950 hover:shadow-gold active:scale-95'}`}>
      {isLaunching && progress && <div className="absolute inset-0 bg-gold-500/10 transition-all duration-300" style={{width:`${progress.percent}%`}} />}
      <span className="relative flex items-center gap-2">
        {isLaunching ? <Loader2 size={s.icon} className="animate-spin" /> : isRunning ? <Square size={s.icon} /> : <Play size={s.icon} fill="currentColor" />}
        {isLaunching ? (progress?.percent<90 ? `${progress.percent}%` : 'Starting...') : isRunning ? 'Stop' : 'Launch'}
      </span>
    </motion.button>
  );
}
