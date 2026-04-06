import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Zap, Shield, ArrowRight, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import useStore from '../store/useStore';
const gc = window.goldClient;

export default function Login() {
  const { setAuth } = useStore();
  const [tab,       setTab]       = useState('offline'); // 'offline' | 'microsoft'
  const [username,  setUsername]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [msLoading, setMsLoading] = useState(false);

  async function handleOffline(e) {
    e.preventDefault();
    if (!username.trim() || loading) return;
    setLoading(true);
    try {
      const p = await gc.auth.loginOffline(username.trim());
      setAuth(p);
      toast.success(`Welcome, ${p.username}!`, { icon: '⚔️' });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleMicrosoft() {
    setMsLoading(true);
    try {
      // This opens a BrowserWindow for Microsoft OAuth.
      // The promise resolves once the user completes auth.
      const p = await gc.auth.loginMicrosoft();
      setAuth(p);
      toast.success(`Welcome, ${p.username}!`, { icon: '⚔️' });
    } catch (err) {
      if (err.message?.includes('cancelled')) {
        toast('Login cancelled', { icon: 'ℹ️' });
      } else {
        toast.error(err.message || 'Microsoft login failed');
      }
    } finally {
      setMsLoading(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-dark-950 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gold-500/5 rounded-full blur-3xl" />
        <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage:'linear-gradient(#f59e0b 1px,transparent 1px),linear-gradient(90deg,#f59e0b 1px,transparent 1px)',backgroundSize:'60px 60px'}} />
      </div>

      <motion.div initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:0.45,ease:'easeOut'}} className="relative z-10 w-full max-w-sm px-6">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <motion.div initial={{scale:0.8}} animate={{scale:1}} transition={{duration:0.4,type:'spring',bounce:0.4}} className="relative w-20 h-20 mb-4">
            <div className="absolute inset-0 rounded-2xl border border-gold-500/20 animate-spin-slow" />
            <div className="absolute inset-1.5 bg-gold-gradient rounded-xl flex items-center justify-center shadow-gold-lg">
              <span className="font-display text-4xl font-bold text-dark-950">G</span>
            </div>
          </motion.div>
          <h1 className="font-display text-3xl font-bold text-gradient-gold tracking-widest uppercase">Gold Client</h1>
          <p className="text-dark-500 text-sm mt-1">High-performance Minecraft launcher</p>
        </div>

        {/* Feature pills */}
        <div className="flex justify-center gap-2 mb-6 flex-wrap">
          {[{icon:Zap,label:'Max FPS'},{icon:Shield,label:'Mod Safe'},{icon:CheckCircle,label:'MS Auth'}].map(({icon:Icon,label}) => (
            <div key={label} className="flex items-center gap-1.5 px-3 py-1 bg-dark-800/80 border border-dark-700 rounded-full text-xs text-dark-400">
              <Icon size={11} className="text-gold-500" />{label}
            </div>
          ))}
        </div>

        <div className="card p-6">
          {/* Tab switcher */}
          <div className="flex bg-dark-900 rounded-xl p-1 mb-5">
            <button onClick={()=>setTab('offline')}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab==='offline' ? 'bg-dark-700 text-dark-100 shadow' : 'text-dark-500 hover:text-dark-300'
              }`}>
              Offline
            </button>
            <button onClick={()=>setTab('microsoft')}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab==='microsoft' ? 'bg-dark-700 text-dark-100 shadow' : 'text-dark-500 hover:text-dark-300'
              }`}>
              Microsoft
            </button>
          </div>

          <AnimatePresence mode="wait">
            {tab === 'offline' ? (
              <motion.div key="offline" initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-10}} transition={{duration:0.18}}>
                <p className="text-dark-500 text-xs mb-4">Play without a Minecraft account. Any username works.</p>
                <form onSubmit={handleOffline} className="space-y-3">
                  <div>
                    <label className="label">Username</label>
                    <div className="relative">
                      <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
                      <input className="input pl-9" placeholder="Enter username..." value={username} onChange={e=>setUsername(e.target.value)} maxLength={16} autoFocus disabled={loading} />
                    </div>
                    <p className="text-dark-600 text-[10px] mt-1">2–16 chars, letters / numbers / underscores</p>
                  </div>
                  <button type="submit" disabled={!username.trim()||loading} className="btn-gold w-full flex items-center justify-center gap-2">
                    {loading
                      ? <><Loader2 size={14} className="animate-spin" />Signing in...</>
                      : <><span>Enter Launcher</span><ArrowRight size={14} /></>}
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div key="microsoft" initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} exit={{opacity:0,x:10}} transition={{duration:0.18}}>
                <p className="text-dark-500 text-xs mb-4">
                  Sign in with your Microsoft account that owns Minecraft Java Edition.
                  A browser window will open for authentication.
                </p>
                <button
                  onClick={handleMicrosoft}
                  disabled={msLoading}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4
                             bg-dark-900 hover:bg-dark-800 border border-dark-600 hover:border-dark-500
                             rounded-xl transition-all duration-200 disabled:opacity-60 disabled:cursor-wait"
                >
                  {msLoading ? (
                    <><Loader2 size={16} className="animate-spin text-gold-400" /><span className="text-dark-200 text-sm font-medium">Waiting for Microsoft...</span></>
                  ) : (
                    <>
                      <MicrosoftIcon />
                      <span className="text-dark-200 text-sm font-medium">Sign in with Microsoft</span>
                    </>
                  )}
                </button>
                <div className="mt-3 p-3 bg-dark-900/60 border border-dark-800 rounded-xl">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={13} className="text-dark-500 mt-0.5 flex-shrink-0" />
                    <p className="text-dark-600 text-[10px] leading-relaxed">
                      Gold Client uses the standard Xbox OAuth flow.
                      Your credentials go directly to Microsoft — we never see your password.
                      Requires Minecraft Java Edition ownership.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-dark-700 text-[10px] text-center mt-4">
          Gold Client is not affiliated with Mojang Studios or Microsoft
        </p>
      </motion.div>
    </div>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
    </svg>
  );
}
