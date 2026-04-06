/**
 * Gold Client — LaunchButton
 *
 * Three-state button:
 *   • 'idle'      → Gold "Launch" button
 *   • 'launching' → Amber progress bar button (launching in progress)
 *   • 'running'   → Red "Stop" button (game confirmed running)
 *
 * The 'launching' state is driven by launchingInstances (set on click,
 * cleared when game actually starts OR when launch fails).
 * The 'running' state is only set after the game emits its first output.
 *
 * This prevents the Stop button from appearing when launch fails.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Play, Square, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import useStore from '../store/useStore';

const gc = window.goldClient;

export default function LaunchButton({ instance, size = 'md' }) {
  const {
    runningInstances,
    launchingInstances,
    launchProgress,
    setInstanceLaunching,
    clearInstanceState,
  } = useStore();

  const isRunning   = runningInstances.has(instance.id);
  const isLaunching = launchingInstances.has(instance.id) && !isRunning;
  const progress    = launchProgress[instance.id];

  const sizes = {
    sm: { btn: 'px-3 py-1.5 text-xs gap-1.5', icon: 12 },
    md: { btn: 'px-4 py-2   text-sm gap-2',   icon: 14 },
    lg: { btn: 'px-6 py-3   text-base gap-2.5', icon: 16 },
  };
  const s = sizes[size] || sizes.md;

  async function handleLaunch() {
    // ── Stop running game ───────────────────────────────────────
    if (isRunning) {
      if (!window.confirm(`Stop "${instance.name}"?`)) return;
      try {
        await gc.launcher.kill(instance.id);
        toast('Game stopped', { icon: '⏹️' });
      } catch (err) {
        toast.error(err.message);
      }
      return;
    }

    // ── Prevent double-launch while loading ────────────────────
    if (isLaunching) return;

    // ── Start launch flow ───────────────────────────────
    setInstanceLaunching(instance.id, true);

    try {
      await gc.launcher.launch(instance.id);
      // Success path: game started, state transitions handled by
      // the launcher:game-start and launcher:game-close IPC events in App.jsx
    } catch (err) {
      // Launch failed — clear ALL state so button returns to idle
      clearInstanceState(instance.id);
      toast.error(
        `Failed to launch "${instance.name}":\n${err.message}`,
        { duration: 8000, style: { whiteSpace: 'pre-line', maxWidth: '420px' } }
      );
    }
  }

  // Determine button label
  const label = isRunning   ? 'Stop'
    : isLaunching && progress ? `${progress.percent}%`
    : isLaunching             ? 'Starting...'
    : 'Launch';

  return (
    <motion.button
      onClick={handleLaunch}
      whileTap={{ scale: 0.96 }}
      disabled={isLaunching && !isRunning}
      className={`
        relative inline-flex items-center justify-center font-semibold rounded-xl
        transition-all duration-200 overflow-hidden select-none
        ${s.btn}
        ${isRunning
          ? 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 cursor-pointer'
          : isLaunching
            ? 'bg-gold-500/15 border border-gold-500/30 text-gold-400 cursor-wait'
            : 'bg-gold-gradient text-dark-950 hover:shadow-gold active:scale-95 cursor-pointer'
        }
      `}
    >
      {/* Progress fill during launch */}
      {isLaunching && progress && (
        <div
          className="absolute inset-y-0 left-0 bg-gold-500/20 transition-all duration-500"
          style={{ width: `${progress.percent}%` }}
        />
      )}

      <span className="relative flex items-center gap-2">
        {isLaunching
          ? <Loader2 size={s.icon} className="animate-spin" />
          : isRunning
            ? <Square size={s.icon} />
            : <Play   size={s.icon} fill="currentColor" />
        }
        {label}
      </span>
    </motion.button>
  );
}
