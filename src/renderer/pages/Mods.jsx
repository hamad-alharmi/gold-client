import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Upload, FolderOpen, AlertTriangle, CheckCircle, ToggleLeft, ToggleRight, Trash2, RefreshCw, ChevronDown, Search, X, Shield, Puzzle } from 'lucide-react';
import toast from 'react-hot-toast';
import useStore from '../store/useStore';
const gc = window.goldClient;
const BADGE = { fabric:'badge-blue', forge:'badge-purple', quilt:'badge-green', unknown:'badge-gray' };
function fmtBytes(b) { if(b<1024)return`${b}B`; if(b<1024*1024)return`${(b/1024).toFixed(0)}KB`; return`${(b/1024/1024).toFixed(1)}MB`; }

export default function Mods() {
  const { instances, mods, setMods } = useStore();
  const [selectedId,setSelectedId]=useState(instances[0]?.id||null), [search,setSearch]=useState('');
  const [dragging,setDragging]=useState(false), [loading,setLoading]=useState(false), [validation,setValidation]=useState(null);
  const dropRef = useRef(null);
  const instMods = mods[selectedId]||[];
  const filtered = instMods.filter(m=>m.name.toLowerCase().includes(search.toLowerCase())||m.filename.toLowerCase().includes(search.toLowerCase()));
  const enabledCount = instMods.filter(m=>m.enabled).length;

  useEffect(() => { if (!selectedId) return; setLoading(true); gc.mods.list(selectedId).then(ms=>setMods(selectedId,ms)).catch(err=>toast.error(err.message)).finally(()=>setLoading(false)); }, [selectedId]);

  const onDragOver = useCallback(e => { e.preventDefault(); if (!dragging) setDragging(true); }, [dragging]);
  const onDragLeave = useCallback(e => { if (!dropRef.current?.contains(e.relatedTarget)) setDragging(false); }, []);
  const onDrop = useCallback(async e => {
    e.preventDefault(); setDragging(false);
    if (!selectedId) { toast.error('Select an instance first'); return; }
    const files = [...e.dataTransfer.files].filter(f=>f.name.endsWith('.jar')).map(f=>f.path);
    if (!files.length) { toast.error('No .jar files dropped'); return; }
    try { const imp = await gc.mods.import(selectedId,files); setMods(selectedId,await gc.mods.list(selectedId)); toast.success(`Imported ${imp.length} mod${imp.length!==1?'s':''}`); }
    catch (err) { toast.error(err.message); }
  }, [selectedId]);

  async function browseImport() {
    if (!selectedId) { toast.error('Select an instance first'); return; }
    const r = await gc.dialog.openFile({ title:'Select Mod JARs', filters:[{name:'Mod JARs',extensions:['jar']}], properties:['openFile','multiSelections'] });
    if (r.canceled||!r.filePaths.length) return;
    try { const imp = await gc.mods.import(selectedId,r.filePaths); setMods(selectedId,await gc.mods.list(selectedId)); toast.success(`Imported ${imp.length} mod${imp.length!==1?'s':''}`); }
    catch (err) { toast.error(err.message); }
  }
  async function toggle(mid) { try { await gc.mods.toggle(selectedId,mid); setMods(selectedId,await gc.mods.list(selectedId)); } catch(e){toast.error(e.message);} }
  async function remove(mod) { if (!window.confirm(`Remove "${mod.name}"?`)) return; try { await gc.mods.remove(selectedId,mod.id); setMods(selectedId,await gc.mods.list(selectedId)); toast.success(`Removed "${mod.name}"`); } catch(e){toast.error(e.message);} }
  async function validate() { try { setValidation(await gc.mods.validate(selectedId)); } catch(e){toast.error(e.message);} }

  return (
    <div ref={dropRef} className={`h-full flex flex-col overflow-hidden transition-all ${dragging?'drop-zone-active':''}`} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <div className="px-8 pt-6 pb-4 border-b border-dark-800/60 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div><h1 className="section-title">Mods</h1><p className="section-subtitle">{selectedId?`${instMods.length} mods · ${enabledCount} enabled`:'Select an instance'}</p></div>
          {selectedId&&<div className="flex items-center gap-2">
            <button onClick={validate} className="btn-ghost flex items-center gap-2 text-sm"><Shield size={14}/>Validate</button>
            <button onClick={()=>gc.mods.openDir(selectedId)} className="btn-ghost flex items-center gap-2 text-sm"><FolderOpen size={14}/>Open Folder</button>
            <button onClick={browseImport} className="btn-gold flex items-center gap-2"><Upload size={14}/>Import Mods</button>
          </div>}
        </div>
        <div className="flex gap-3">
          <div className="relative flex-shrink-0">
            <select className="input h-9 pr-8 text-sm appearance-none bg-dark-900 cursor-pointer w-48" value={selectedId||''} onChange={e=>setSelectedId(e.target.value)}>
              <option value="" disabled>Select instance...</option>
              {instances.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 pointer-events-none" />
          </div>
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
            <input className="input pl-8 h-9 text-sm" placeholder="Search mods..." value={search} onChange={e=>setSearch(e.target.value)} />
            {search&&<button onClick={()=>setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500"><X size={13}/></button>}
          </div>
        </div>
      </div>
      <AnimatePresence>
        {validation&&(validation.errors.length>0||validation.warnings.length>0)&&(
          <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} className="mx-8 mt-3 overflow-hidden">
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
              {validation.errors.map((e,i)=><div key={i} className="flex items-start gap-2 text-red-400 text-sm mb-1"><AlertTriangle size={14} className="mt-0.5 flex-shrink-0"/>{e}</div>)}
              {validation.warnings.map((w,i)=><div key={i} className="flex items-start gap-2 text-yellow-400 text-sm"><AlertTriangle size={14} className="mt-0.5 flex-shrink-0"/>{w}</div>)}
              {!validation.errors.length&&!validation.warnings.length&&<div className="flex items-center gap-2 text-green-400 text-sm"><CheckCircle size={14}/>All mods are compatible</div>}
            </div>
            <button onClick={()=>setValidation(null)} className="btn-ghost text-xs mt-1 float-right">Dismiss</button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex-1 overflow-y-auto px-8 py-4">
        {!selectedId ? <div className="flex flex-col items-center justify-center py-16 text-center"><Package size={28} className="text-dark-700 mb-3"/><p className="text-dark-500 text-sm">Select an instance to manage mods</p></div>
          : loading ? <div className="flex items-center justify-center h-32"><RefreshCw size={20} className="text-gold-500 animate-spin"/></div>
          : dragging ? <div className="flex flex-col items-center justify-center h-48 gap-3 border-2 border-dashed border-gold-500/50 rounded-2xl bg-gold-500/5 text-gold-400"><Upload size={28} className="animate-bounce-subtle"/><p className="font-display text-lg font-semibold">Drop JARs here</p><p className="text-sm text-gold-500/60">Release to import</p></div>
          : filtered.length===0 ? <div className="flex flex-col items-center justify-center py-16 text-center"><div className="w-14 h-14 bg-dark-800 border border-dark-700 rounded-2xl flex items-center justify-center mb-4"><Package size={22} className="text-dark-500"/></div><h3 className="font-display text-lg font-semibold text-dark-300 mb-2">{search?'No mods found':'No mods imported'}</h3>{!search&&<><p className="text-dark-600 text-sm mb-5">Drag & drop .jar files or click Import</p><button onClick={browseImport} className="btn-gold-outline flex items-center gap-2"><Upload size={14}/>Import Mods</button></>}</div>
          : <div className="space-y-2"><AnimatePresence mode="popLayout">{filtered.map((mod,idx)=>(
            <motion.div key={mod.id} layout initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,scale:0.96}} transition={{delay:idx*0.03,duration:0.2}}>
              <div className={`flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all duration-200 ${mod.enabled?'bg-dark-900/60 border-dark-800 hover:border-dark-700':'bg-dark-900/30 border-dark-800/50 opacity-60'}`}>
                <div className="w-10 h-10 bg-dark-800 border border-dark-700 rounded-lg flex items-center justify-center flex-shrink-0"><Puzzle size={16} className="text-dark-500"/></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5"><span className={`font-medium text-sm truncate ${mod.enabled?'text-dark-100':'text-dark-500'}`}>{mod.name}</span><span className={`${BADGE[mod.loader]||'badge-gray'} capitalize`}>{mod.loader}</span>{mod.version&&mod.version!=='Unknown'&&<span className="badge-gray">v{mod.version}</span>}</div>
                  <div className="flex items-center gap-2 text-xs"><span className="text-dark-600 truncate">{mod.filename}</span>{mod.author&&mod.author!=='Unknown'&&<><span className="text-dark-700">·</span><span className="text-dark-600">by {mod.author}</span></>}{mod.size>0&&<><span className="text-dark-700">·</span><span className="text-dark-700">{fmtBytes(mod.size)}</span></>}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={()=>toggle(mod.id)} className="text-dark-500 hover:text-dark-200 transition-colors">{mod.enabled?<ToggleRight size={20} className="text-gold-500"/>:<ToggleLeft size={20}/>}</button>
                  <button onClick={()=>remove(mod)} className="text-dark-600 hover:text-red-400 transition-colors p-1"><Trash2 size={14}/></button>
                </div>
              </div>
            </motion.div>
          ))}</AnimatePresence></div>
        }
      </div>
    </div>
  );
}
