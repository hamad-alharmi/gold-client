import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Zap, Shield, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import useStore from '../store/useStore';
const gc = window.goldClient;

export default function Login() {
  const { setAuth } = useStore();
  const [username, setUsername] = useState(''), [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    try { const p = await gc.auth.loginOffline(username.trim()); setAuth(p); toast.success(`Welcome, ${p.username}!`, { icon:'⚔️' }); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-dark-950 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gold-500/5 rounded-full blur-3xl" />
        <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage:'linear-gradient(#f59e0b 1px,transparent 1px),linear-gradient(90deg,#f59e0b 1px,transparent 1px)',backgroundSize:'60px 60px'}} />
      </div>
      <motion.div initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:0.5}} className="relative z-10 w-full max-w-sm px-6">
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
        <div className="flex justify-center gap-2 mb-8 flex-wrap">
          {[{icon:Zap,label:'Max FPS'},{icon:Shield,label:'Mod Safe'},{icon:User,label:'All Versions'}].map(({icon:Icon,label}) => (
            <div key={label} className="flex items-center gap-1.5 px-3 py-1 bg-dark-800/80 border border-dark-700 rounded-full text-xs text-dark-400">
              <Icon size={11} className="text-gold-500" />{label}
            </div>
          ))}
        </div>
        <div className="card p-6 space-y-4">
          <div><h2 className="font-display text-lg font-semibold text-dark-100 mb-1">Quick Login</h2><p className="text-dark-500 text-xs">Enter any username to play in offline mode</p></div>
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="label">Username</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
                <input className="input pl-9" placeholder="Enter username..." value={username} onChange={e=>setUsername(e.target.value)} maxLength={16} autoFocus disabled={loading} />
              </div>
              <p className="text-dark-600 text-[10px] mt-1">2–16 characters, letters/numbers/underscores only</p>
            </div>
            <button type="submit" disabled={!username.trim()||loading} className="btn-gold w-full flex items-center justify-center gap-2">
              {loading ? <span className="flex gap-1">{[0,1,2].map(i=><motion.span key={i} className="w-1.5 h-1.5 bg-dark-950 rounded-full block" animate={{opacity:[0.3,1,0.3]}} transition={{duration:0.8,delay:i*0.15,repeat:Infinity}} />)}</span> : <><span>Enter Launcher</span><ArrowRight size={15} /></>}
            </button>
          </form>
          <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-dark-700" /></div><div className="relative flex justify-center"><span className="bg-dark-800 px-3 text-dark-600 text-xs">or</span></div></div>
          <button className="btn-ghost w-full text-sm opacity-50 cursor-not-allowed" disabled title="Requires Azure AD setup">
            <div className="flex items-center justify-center gap-2">
              <svg width="14" height="14" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#f25022"/><rect x="11" y="1" width="9" height="9" fill="#7fba00"/><rect x="1" y="11" width="9" height="9" fill="#00a4ef"/><rect x="11" y="11" width="9" height="9" fill="#ffb900"/></svg>
              <span>Microsoft Account</span><span className="badge-gray text-[10px]">Soon</span>
            </div>
          </button>
        </div>
        <p className="text-dark-600 text-[10px] text-center mt-4">Gold Client is not affiliated with Mojang Studios or Microsoft</p>
      </motion.div>
    </div>
  );
}
