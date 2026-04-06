import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
const gc = window.goldClient;
const LOADERS = ['vanilla','fabric','forge','quilt'];
const LL = { vanilla:'Vanilla', fabric:'Fabric', forge:'Forge', quilt:'Quilt' };
const ICONS = ['grass','diamond','sword','fire','earth','ice','star','rocket','skull','heart'];
const IE = { grass:'🌿',diamond:'💎',sword:'⚔️',fire:'🔥',earth:'🌍',ice:'❄️',star:'⭐',rocket:'🚀',skull:'💀',heart:'❤️' };

export default function CreateInstanceModal({ open, onClose, onCreated }) {
  const [name,setName]=useState(''), [mcVersion,setMcVersion]=useState(''), [modLoader,setModLoader]=useState('vanilla');
  const [loaderVersion,setLoaderVersion]=useState(''), [icon,setIcon]=useState('grass'), [group,setGroup]=useState('Default');
  const [includeSnapshots,setIncludeSnapshots]=useState(false), [versions,setVersions]=useState([]);
  const [loaderVersions,setLoaderVersions]=useState([]), [loadingVersions,setLoadingVersions]=useState(false);
  const [loadingLoaders,setLoadingLoaders]=useState(false), [creating,setCreating]=useState(false);
  const [versionSearch,setVersionSearch]=useState('');

  useEffect(() => {
    if (!open) return;
    setLoadingVersions(true);
    gc.launcher.getVersions({ includeSnapshots })
      .then(vs => { setVersions(vs); if (vs.length) setMcVersion(vs[0].id); })
      .catch(err => toast.error(err.message))
      .finally(() => setLoadingVersions(false));
  }, [open, includeSnapshots]);

  useEffect(() => {
    if (!mcVersion || modLoader==='vanilla') { setLoaderVersions([]); return; }
    setLoadingLoaders(true);
    gc.launcher.getModLoaders(mcVersion)
      .then(d => { const ld=d[modLoader]||[]; setLoaderVersions(ld); setLoaderVersion(ld[0]?.version||''); })
      .catch(() => setLoaderVersions([]))
      .finally(() => setLoadingLoaders(false));
  }, [mcVersion, modLoader]);

  const filteredVersions = versions.filter(v => v.id.includes(versionSearch) || v.type.includes(versionSearch.toLowerCase()));

  async function handleCreate() {
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (!mcVersion)   { toast.error('Select a version'); return; }
    setCreating(true);
    try {
      await gc.instances.create({ name:name.trim(), mcVersion, modLoader, modLoaderVersion:loaderVersion, icon, group });
      toast.success(`Created "${name.trim()}"`);
      setName(''); setMcVersion(''); setModLoader('vanilla'); setLoaderVersion(''); setIcon('grass'); setGroup('Default');
      onCreated();
    } catch (err) { toast.error(err.message); }
    finally { setCreating(false); }
  }

  if (!open) return null;
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 bg-dark-950/80 backdrop-blur-sm" onClick={onClose} />
        <motion.div initial={{opacity:0,scale:0.95,y:16}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.95}} transition={{duration:0.2}} className="relative z-10 w-full max-w-lg card p-6 shadow-dark">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-xl font-bold text-dark-50">Create Instance</h2>
            <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg"><X size={16} /></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="label">Instance Name</label>
              <input className="input" placeholder="My Survival World" value={name} onChange={e=>setName(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label">Icon</label>
              <div className="flex gap-2 flex-wrap">
                {ICONS.map(ic => (
                  <button key={ic} onClick={()=>setIcon(ic)} className={`w-10 h-10 rounded-xl text-xl transition-all duration-150 ${icon===ic?'bg-gold-500/20 border-2 border-gold-500 shadow-gold scale-110':'bg-dark-800 border border-dark-700 hover:border-dark-500'}`}>{IE[ic]}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Minecraft Version</label>
                <label className="flex items-center gap-1.5 text-xs text-dark-500 cursor-pointer">
                  <input type="checkbox" checked={includeSnapshots} onChange={e=>setIncludeSnapshots(e.target.checked)} className="rounded" /> Snapshots
                </label>
              </div>
              <div className="bg-dark-900 border border-dark-600 rounded-xl overflow-hidden">
                <div className="relative border-b border-dark-700">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
                  <input className="w-full bg-transparent pl-8 pr-3 py-2 text-sm text-dark-200 placeholder-dark-600 outline-none" placeholder="Search versions..." value={versionSearch} onChange={e=>setVersionSearch(e.target.value)} />
                </div>
                <div className="h-36 overflow-y-auto">
                  {loadingVersions ? <div className="flex items-center justify-center h-full"><Loader2 size={16} className="text-gold-500 animate-spin" /></div> :
                    filteredVersions.map(v => (
                      <button key={v.id} onClick={()=>setMcVersion(v.id)} className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors text-left ${mcVersion===v.id?'bg-gold-500/15 text-gold-300':'text-dark-300 hover:bg-dark-800 hover:text-dark-100'}`}>
                        <span>{v.id}</span>
                        {v.type!=='release' && <span className="badge-gray text-[10px]">{v.type}</span>}
                      </button>
                    ))
                  }
                </div>
              </div>
            </div>
            <div>
              <label className="label">Mod Loader</label>
              <div className="grid grid-cols-4 gap-2">
                {LOADERS.map(l => (
                  <button key={l} onClick={()=>setModLoader(l)} className={`py-2 rounded-xl text-sm font-medium transition-all ${modLoader===l?'bg-gold-500 text-dark-950':'bg-dark-800 border border-dark-700 text-dark-400 hover:text-dark-200 hover:border-dark-600'}`}>{LL[l]}</button>
                ))}
              </div>
            </div>
            {modLoader!=='vanilla' && (
              <div>
                <label className="label">{LL[modLoader]} Version</label>
                {loadingLoaders ? <div className="flex items-center gap-2 text-dark-500 text-sm"><Loader2 size={14} className="animate-spin" />Fetching...</div> :
                  loaderVersions.length===0 ? <p className="text-dark-600 text-sm">No {modLoader} versions for {mcVersion}</p> :
                  <select className="input bg-dark-900 appearance-none" value={loaderVersion} onChange={e=>setLoaderVersion(e.target.value)}>
                    {loaderVersions.map(v => <option key={v.version} value={v.version}>{v.version}{v.stable===false?' (unstable)':''}</option>)}
                  </select>
                }
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={onClose} className="btn-ghost">Cancel</button>
            <button onClick={handleCreate} disabled={creating||!name.trim()||!mcVersion} className="btn-gold flex items-center gap-2">
              {creating ? <><Loader2 size={14} className="animate-spin" />Creating...</> : 'Create Instance'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
