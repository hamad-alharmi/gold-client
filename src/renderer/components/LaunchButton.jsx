/**
 * Gold Client — LaunchButton
 *
 * The IPC handler now returns immediately (fire-and-forget).
 * All state changes come via IPC events handled in App.jsx:
 *
 *   launcher:progress  → setLaunchProgress
 *   launcher:game-start → setInstanceRunning(true)  [clears launching]
 *   launcher:game-close → setInstanceRunning(false)
 *   launcher:error     → clearInstanceState         [resets button to idle]
 *
 * Three visual states:
 *   idle      → Gold ▶ Launch button
 *   launching → Amber spinner + progress percent (assets downloading / game starting)
 *   running   → Red ■ Stop button
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

  const sz = {
    sm: { cls: 'px-3 py-1.5 text-xs gap-1.5', icon: 12 },
    md: { cls: 'px-4 py-2   text-sm gap-2',   icon: 14 },
    lg: { cls: 'px-6 py-3   text-base gap-2.5', icon: 16 },
  }[size] || { cls: 'px-4 py-2 text-sm gap-2', icon: 14 };

  async function handleClick() {
    if (isRunning) {
      // ── Stop the game ──────────────────────────────────────────
      if (!window.confirm(`Stop "${instance.name}"?`)) return;
      try {
        await gc.launcher.kill(instance.id);
        toast('Game stopped', { icon: '⏹️' });
      } catch (err) {
        toast.error(err.message);
      }
      return;
    }

    if (isLaunching) return; // already in progress

    // ── Start the launch flow ──────────────────────────────────────
    //
    // Mark as "launching" immediately so the button shows the spinner.
    // The IPC handler returns right away (fire-and-forget).
    // Actual state transitions come via IPC events in App.jsx:
    //   • launcher:game-start -> setInstanceRunning(true)  [clears launching]
    //   • launcher:error      -> clearInstanceState        [back to idle]
    //
    setInstanceLaunching(instance.id, true);

    try {
      // This invoke returns immediately — does NOT wait for game to start
      await gc.launcher.launch(instance.id);
    } catch (err) {
      // Synchronous validation errors (instance not found, not logged in)
      // arrive as IPC invoke rejections. Clear state and show toast.
      clearInstanceState(instance.id);
      toast.error(err.message, {
        duration: 8000,
        style: { whiteSpace: 'pre-line', maxWidth: '440px' },
      });
    }
    // Note: we do NOT clearInstanceState here on success —
    // launcher:game-start will transition from launching → running,
    // and launcher:error will reset to idle if anything goes wrong.
  }

  // Button label
  const label = isRunning
    ? 'Stop'
    : isLaunching && progress?.percent != null
      ? `${progress.percent}%`
      : isLaunching
        ? 'Starting…'
        : 'Launch';

  return (
    <motion.button
      onClick={handleClick}
      whileTap={{ scale: 0.96 }}
      disabled={isLaunching && !isRunning}
      title={isLaunching && progress?.message ? progress.message : undefined}
      className={`
        relative inline-flex items-center justify-center font-semibold rounded-xl
        transition-all duration-200 overflow-hidden select-none
        ${sz.cls}
        ${isRunning
          ? 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 cursor-pointer'
          : isLaunching
            ? 'bg-gold-500/15 border border-gold-500/30 text-gold-400 cursor-wait'
            : 'bg-gold-gradient text-dark-950 hover:shadow-gold active:scale-95 cursor-pointer'
        }
      `}
    >
      {/* Progress bar fill */}
      {isLaunching && progress?.percent != null && (
        <div
          className="absolute inset-y-0 left-0 bg-gold-500/20 transition-all duration-500"
          style={{ width: `${progress.percent}%` }}
        />
      )}

      <span className="relative flex items-center gap-2">
        {isLaunching
          ? <Loader2 size={sz.icon} className="animate-spin" />
          : isRunning
            ? <Square size={sz.icon} />
            : <Play   size={sz.icon} fill="currentColor" />
        }
        {label}
      </span>
    </motion.button>
  );
}
