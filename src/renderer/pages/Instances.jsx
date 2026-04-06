import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Layers, FolderOpen, Trash2, Edit3, Copy, MoreVertical, X } from 'lucide-react';
import toast from 'react-hot-toast';
import useStore from '../store/useStore';
import LaunchButton from '../components/LaunchButton';
import CreateInstanceModal from '../components/modals/CreateInstanceModal';
import EditInstanceModal from '../components/modals/EditInstanceModal';
import { LOADER_COLORS, LOADER_LABELS, formatPlaytime, formatDate } from '../utils/helpers';
const gc = window.goldClient;
const ICONS = { grass:'🌿',diamond:'💎',sword:'⚔️',fire:'🔥',earth:'🌍',ice:'❄️',star:'⭐',rocket:'🚀',skull:'💀',heart:'❤️' };

export default function Instances() {
  const { instances, setInstances, runningInstances } = useStore();
  const [search,setSearch]=useState(''), [showCreate,setShowCreate]=useState(false), [editInst,setEditInst]=useState(null), [menuOpen,setMenuOpen]=useState(null);
  const filtered = instances.filter(i => i.name.toLowerCase().includes(search.toLowerCase())||i.mcVersion.includes(search)||i.modLoader.includes(search.toLowerCase()));

  async function del(inst) {
    if (!window.confirm(`Delete "${inst.name}"? This will remove all game files.`)) return;
    try { await gc.instances.delete(inst.id); setInstances(await gc.instances.list()); toast.success(`Deleted "${inst.name}"`); }
    catch (err) { toast.error(err.message); }
  }
  async function dup(inst) {
    try { await gc.instances.create({...inst,name:`${inst.name} (Copy)`,playTime:0,lastPlayed:null}); setInstances(await gc.instances.list()); toast.success(`Duplicated "${inst.name}"`); }
    catch (err) { toast.error(err.message); }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-8 pt-6 pb-4 border-b border-dark-800/60 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div><h1 className="section-title">Instances</h1><p className="section-subtitle">{instances.length} instance{instances.length!==1?'s':''}{runningInstances.size>0&&` · ${runningInstances.size} running`}</p></div>
          <button onClick={()=>setShowCreate(true)} className="btn-gold flex items-center gap-2"><Plus size={15}/>New Instance</button>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
          <input className="input pl-9 h-9 text-sm" placeholder="Search instances..." value={search} onChange={e=>setSearch(e.target.value)} />
          {search&&<button onClick={()=>setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300"><X size={13}/></button>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-8 py-4 space-y-2">
        <AnimatePresence mode="popLayout">
          {filtered.length===0 ? (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-dark-800 border border-dark-700 rounded-2xl flex items-center justify-center text-3xl mb-4">{search?<Search size={24} className="text-dark-500"/>:<Layers size={24} className="text-dark-500"/>}</div>
              <h3 className="font-display text-lg font-semibold text-dark-300 mb-2">{search?'No results found':'No instances yet'}</h3>
              <p className="text-dark-600 text-sm mb-5">{search?`Nothing matching "${search}"`:"Create your first instance to start playing"}</p>
              {search?<button onClick={()=>setSearch('')} className="btn-ghost text-sm">Clear search</button>:<button onClick={()=>setShowCreate(true)} className="btn-gold flex items-center gap-2"><Plus size={14}/>Create Instance</button>}
            </motion.div>
          ) : filtered.map((inst,idx) => (
            <motion.div key={inst.id} layout initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0,scale:0.97}} transition={{delay:idx*0.04,duration:0.25}}>
              <div className={`relative flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all duration-200 ${runningInstances.has(inst.id)?'bg-green-500/5 border-green-500/20':'bg-dark-900/60 border-dark-800 hover:border-dark-700 hover:bg-dark-800/40'}`}>
                <div className="w-12 h-12 bg-dark-800 border border-dark-700 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">{ICONS[inst.icon]||'🌿'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-semibold text-dark-100 truncate">{inst.name}</h3>
                    {runningInstances.has(inst.id)&&<span className="badge-green text-[10px]"><span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />Running</span>}
                  </div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-dark-400 text-xs">{inst.mcVersion}</span><span className="text-dark-700 text-xs">•</span>
                    <span className={`text-xs capitalize ${LOADER_COLORS[inst.modLoader]||'text-dark-500'}`}>{LOADER_LABELS[inst.modLoader]||inst.modLoader}</span>
                    {inst.lastPlayed&&<><span className="text-dark-700 text-xs">•</span><span className="text-dark-600 text-xs">{formatDate(inst.lastPlayed)}</span></>}
                    {inst.playTime>0&&<><span className="text-dark-700 text-xs">•</span><span className="text-dark-600 text-xs">{formatPlaytime(inst.playTime)}</span></>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <LaunchButton instance={inst} size="sm" />
                  <div className="relative">
                    <button onClick={()=>setMenuOpen(menuOpen===inst.id?null:inst.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-dark-500 hover:text-dark-200 hover:bg-dark-700 transition-all"><MoreVertical size={15}/></button>
                    <AnimatePresence>
                      {menuOpen===inst.id&&(
                        <><div className="fixed inset-0 z-40" onClick={()=>setMenuOpen(null)} />
                        <motion.div initial={{opacity:0,scale:0.92,y:-4}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.92}} transition={{duration:0.12}} className="absolute right-0 top-10 z-50 w-44 card shadow-dark border-dark-700 overflow-hidden">
                          {[{icon:Edit3,label:'Edit',action:()=>{setEditInst(inst);setMenuOpen(null);}},{icon:Copy,label:'Duplicate',action:()=>{dup(inst);setMenuOpen(null);}},{icon:FolderOpen,label:'Open Folder',action:()=>{gc.instances.openDir(inst.id);setMenuOpen(null);}}].map(({icon:Icon,label,action})=>(
                            <button key={label} onClick={action} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-dark-300 hover:text-dark-100 hover:bg-dark-700 transition-colors text-sm"><Icon size={13}/>{label}</button>
                          ))}
                          <div className="h-px bg-dark-700 mx-2" />
                          <button onClick={()=>{del(inst);setMenuOpen(null);}} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-red-400 hover:bg-red-500/10 transition-colors text-sm"><Trash2 size={13}/>Delete</button>
                        </motion.div></>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <CreateInstanceModal open={showCreate} onClose={()=>setShowCreate(false)} onCreated={async()=>{setInstances(await gc.instances.list());setShowCreate(false);}} />
      <EditInstanceModal open={!!editInst} instance={editInst} onClose={()=>setEditInst(null)} onSaved={async()=>{setInstances(await gc.instances.list());setEditInst(null);}} />
    </div>
  );
}
