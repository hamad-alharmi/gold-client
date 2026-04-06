import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
const gc = window.goldClient;
const ICONS = ['grass','diamond','sword','fire','earth','ice','star','rocket','skull','heart'];
const IE = { grass:'🌿',diamond:'💎',sword:'⚔️',fire:'🔥',earth:'🌍',ice:'❄️',star:'⭐',rocket:'🚀',skull:'💀',heart:'❤️' };

export default function EditInstanceModal({ open, instance, onClose, onSaved }) {
  const [name,setName]=useState(''), [icon,setIcon]=useState('grass'), [group,setGroup]=useState('Default'), [saving,setSaving]=useState(false);
  useEffect(() => { if (instance) { setName(instance.name||''); setIcon(instance.icon||'grass'); setGroup(instance.group||'Default'); } }, [instance]);

  async function handleSave() {
    if (!name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try { await gc.instances.update(instance.id, { name:name.trim(), icon, group }); toast.success('Instance updated'); onSaved(); }
    catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  if (!open||!instance) return null;
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 bg-dark-950/80 backdrop-blur-sm" onClick={onClose} />
        <motion.div initial={{opacity:0,scale:0.95,y:12}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.95}} transition={{duration:0.18}} className="relative z-10 w-full max-w-md card p-6 shadow-dark">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-xl font-bold text-dark-50">Edit Instance</h2>
            <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg"><X size={16} /></button>
          </div>
          <div className="space-y-4">
            <div><label className="label">Name</label><input className="input" value={name} onChange={e=>setName(e.target.value)} autoFocus /></div>
            <div>
              <label className="label">Icon</label>
              <div className="flex gap-2 flex-wrap">
                {ICONS.map(ic => <button key={ic} onClick={()=>setIcon(ic)} className={`w-10 h-10 rounded-xl text-xl transition-all ${icon===ic?'bg-gold-500/20 border-2 border-gold-500 scale-110':'bg-dark-800 border border-dark-700'}`}>{IE[ic]}</button>)}
              </div>
            </div>
            <div><label className="label">Group</label><input className="input" value={group} onChange={e=>setGroup(e.target.value)} placeholder="Default" /></div>
            <div className="bg-dark-900/60 rounded-xl p-3 border border-dark-800 space-y-1">
              <p className="text-dark-500 text-xs">Version: <span className="text-dark-300">{instance.mcVersion}</span></p>
              <p className="text-dark-500 text-xs capitalize">Loader: <span className="text-dark-300">{instance.modLoader}</span></p>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={onClose} className="btn-ghost">Cancel</button>
            <button onClick={handleSave} disabled={saving||!name.trim()} className="btn-gold flex items-center gap-2">
              {saving ? <><Loader2 size={14} className="animate-spin" />Saving...</> : 'Save Changes'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
