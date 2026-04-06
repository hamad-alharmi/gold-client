import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Clock, Layers, Zap, ChevronRight, MemoryStick, Cpu } from 'lucide-react';
import useStore from '../store/useStore';
import { LOADER_COLORS, LOADER_LABELS, formatPlaytime, formatDate } from '../utils/helpers';
import LaunchButton from '../components/LaunchButton';
const gc = window.goldClient;
const ICONS = { grass:'🌿',diamond:'💎',sword:'⚔️',fire:'🔥',earth:'🌍',ice:'❄️',star:'⭐',rocket:'🚀',skull:'💀',heart:'❤️' };

export default function Home() {
  const navigate = useNavigate();
  const { instances, settings, runningInstances, launchProgress } = useStore();
  const [systemInfo, setSystemInfo] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const recent = [...instances].sort((a,b) => (b.lastPlayed||'')>(a.lastPlayed||'')?1:-1).slice(0,5);
  const featured = instances.find(i=>i.id===selectedId) || recent[0] || null;
  useEffect(() => { gc.settings.getSystemRam().then(setSystemInfo).catch(()=>{}); }, []);

  return (
    <div className="h-full flex flex-col overflow-y-auto bg-dark-950">
      {/* Hero */}
      <div className="relative h-56 flex-shrink-0 overflow-hidden bg-dark-900">
        <div className="absolute inset-0 bg-gradient-to-b from-dark-900 via-dark-900/95 to-dark-950" />
        <div className="absolute inset-0" style={{backgroundImage:'linear-gradient(135deg,rgba(245,158,11,0.06) 0%,transparent 60%)'}} />
        <div className="absolute top-0 right-0 w-80 h-80 opacity-[0.04]" style={{backgroundImage:'linear-gradient(45deg,#f59e0b 25%,transparent 25%),linear-gradient(-45deg,#f59e0b 25%,transparent 25%)',backgroundSize:'20px 20px'}} />
        <div className="absolute inset-0 flex items-center px-8 gap-8">
          {featured ? (
            <>
              <div className="w-20 h-20 bg-dark-800 border border-dark-700 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0 shadow-dark">{ICONS[featured.icon]||'🌿'}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="font-display text-2xl font-bold text-dark-50 truncate">{featured.name}</h1>
                  {runningInstances.has(featured.id) && <span className="badge-green text-[10px] animate-pulse">Running</span>}
                </div>
                <div className="flex items-center gap-3 text-sm mb-3">
                  <span className="text-dark-400">{featured.mcVersion}</span>
                  <span className="text-dark-700">•</span>
                  <span className={`capitalize ${LOADER_COLORS[featured.modLoader]||'text-dark-400'}`}>{LOADER_LABELS[featured.modLoader]||featured.modLoader}</span>
                  {featured.lastPlayed && <><span className="text-dark-700">•</span><span className="text-dark-500 text-xs">{formatDate(featured.lastPlayed)}</span></>}
                </div>
                {launchProgress[featured.id] && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1"><span className="text-dark-400">{launchProgress[featured.id].message}</span><span className="text-gold-500">{launchProgress[featured.id].percent}%</span></div>
                    <div className="progress-bar w-64"><div className="progress-fill" style={{width:`${launchProgress[featured.id].percent}%`}} /></div>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0"><LaunchButton instance={featured} size="lg" /></div>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <h1 className="font-display text-3xl font-bold text-gradient-gold tracking-wide">Welcome to Gold Client</h1>
              <p className="text-dark-400 text-sm">Create your first instance to start playing Minecraft with maximum performance.</p>
              <button onClick={()=>navigate('/instances')} className="btn-gold w-fit flex items-center gap-2"><Plus size={15} />Create Instance</button>
            </div>
          )}
        </div>
      </div>
      {/* Body */}
      <div className="flex-1 px-8 py-6 space-y-6">
        {recent.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2"><Clock size={15} className="text-gold-500" /><h2 className="font-display text-base font-semibold text-dark-100 tracking-wide">Recent</h2></div>
              <button onClick={()=>navigate('/instances')} className="text-dark-500 hover:text-gold-400 text-xs flex items-center gap-1 transition-colors">View all <ChevronRight size={12} /></button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {recent.map((inst,idx) => (
                <motion.div key={inst.id} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:idx*0.05,duration:0.3}}>
                  <div onClick={()=>setSelectedId(inst.id)} className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer border transition-all duration-200 ${selectedId===inst.id||(!selectedId&&idx===0)?'bg-gold-500/8 border-gold-500/25':'bg-dark-900/50 border-dark-800 hover:bg-dark-800/60 hover:border-dark-700'}`}>
                    <span className="text-2xl">{ICONS[inst.icon]||'🌿'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><span className="text-dark-100 text-sm font-medium truncate">{inst.name}</span>{runningInstances.has(inst.id)&&<div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />}</div>
                      <div className="flex items-center gap-2 text-xs mt-0.5">
                        <span className="text-dark-500">{inst.mcVersion}</span><span className="text-dark-700">·</span>
                        <span className={`capitalize ${LOADER_COLORS[inst.modLoader]||'text-dark-500'}`}>{inst.modLoader}</span>
                        {inst.playTime>0&&<><span className="text-dark-700">·</span><span className="text-dark-600">{formatPlaytime(inst.playTime)}</span></>}
                      </div>
                    </div>
                    <ChevronRight size={14} className={selectedId===inst.id||(!selectedId&&idx===0)?'text-gold-500':'text-dark-700'} />
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}
        <section>
          <div className="flex items-center gap-2 mb-3"><Cpu size={15} className="text-gold-500" /><h2 className="font-display text-base font-semibold text-dark-100 tracking-wide">System</h2></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-4"><div className="w-8 h-8 bg-dark-700/80 rounded-lg flex items-center justify-center mb-3"><MemoryStick size={16} className="text-gold-400" /></div><p className="text-dark-400 text-xs mb-1">Allocated RAM</p><p className="font-display text-xl font-semibold text-dark-100">{((settings?.ram||2048)/1024).toFixed(1)} GB</p><p className="text-dark-600 text-[11px] mt-0.5">{systemInfo?`of ${(systemInfo.totalMB/1024).toFixed(0)} GB total`:'...'}</p></div>
            <div className="card p-4"><div className="w-8 h-8 bg-dark-700/80 rounded-lg flex items-center justify-center mb-3"><Layers size={16} className="text-blue-400" /></div><p className="text-dark-400 text-xs mb-1">Instances</p><p className="font-display text-xl font-semibold text-dark-100">{instances.length}</p><p className="text-dark-600 text-[11px] mt-0.5">{instances.filter(i=>i.modLoader!=='vanilla').length} modded</p></div>
            <div className={`card p-4 ${settings?.performanceMode!==false?'border-gold-500/20 bg-gold-500/5':''}`}><div className="w-8 h-8 bg-dark-700/80 rounded-lg flex items-center justify-center mb-3"><Zap size={16} className="text-green-400" /></div><p className="text-dark-400 text-xs mb-1">Performance Mode</p><p className="font-display text-xl font-semibold text-dark-100">{settings?.performanceMode!==false?'Enabled':'Disabled'}</p><p className="text-dark-600 text-[11px] mt-0.5">Aikar's JVM flags</p></div>
          </div>
        </section>
        {instances.length===0&&<motion.div initial={{opacity:0,scale:0.97}} animate={{opacity:1,scale:1}} className="card p-8 flex flex-col items-center text-center gap-4"><div className="w-14 h-14 bg-gold-500/10 border border-gold-500/20 rounded-2xl flex items-center justify-center"><Layers size={24} className="text-gold-400" /></div><div><h3 className="font-display text-lg font-semibold text-dark-100">No instances yet</h3><p className="text-dark-500 text-sm mt-1">Create your first Minecraft instance to get started</p></div><button onClick={()=>navigate('/instances')} className="btn-gold"><Plus size={15} className="inline mr-1.5" />Create Instance</button></motion.div>}
      </div>
    </div>
  );
}
