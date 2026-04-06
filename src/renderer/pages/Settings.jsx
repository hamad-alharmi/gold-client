import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings2, MemoryStick, Cpu, Monitor, Zap, FolderOpen, RefreshCw, Save, RotateCcw, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import useStore from '../store/useStore';
const gc = window.goldClient;
const RAM_STEPS = [512,1024,1536,2048,2560,3072,4096,5120,6144,8192,10240,12288,16384];

function Section({ icon, title, children }) {
  return <div><div className="flex items-center gap-2 mb-4"><div className="w-7 h-7 bg-dark-800 rounded-lg flex items-center justify-center">{icon}</div><h2 className="font-display text-base font-semibold text-dark-100">{title}</h2></div><div className="card p-5 space-y-4">{children}</div></div>;
}
function Toggle({ label, description, checked, onChange }) {
  return <div className="flex items-center justify-between gap-4"><div className="min-w-0"><p className="text-dark-200 text-sm font-medium">{label}</p><p className="text-dark-600 text-xs mt-0.5">{description}</p></div><button onClick={()=>onChange(!checked)} className={`toggle flex-shrink-0 ${checked?'toggle-on':'toggle-off'}`} role="switch" aria-checked={checked}><span className={`toggle-thumb ${checked?'toggle-thumb-on':'toggle-thumb-off'}`} /></button></div>;
}

export default function Settings() {
  const { settings, setSettings } = useStore();
  const [local,setLocal]=useState(null), [sysInfo,setSysInfo]=useState(null), [javaList,setJavaList]=useState([]);
  const [jvmPreview,setJvmPreview]=useState([]), [detectingJava,setDetectingJava]=useState(false);
  const [saving,setSaving]=useState(false), [dirty,setDirty]=useState(false);

  useEffect(() => { if (settings) setLocal({...settings}); gc.settings.getSystemRam().then(setSysInfo).catch(()=>{}); }, [settings]);
  useEffect(() => { if (!local) return; gc.settings.getOptimalJvm(local.ram).then(r=>setJvmPreview(r.args)).catch(()=>{}); }, [local?.ram,local?.performanceMode]);

  function upd(k,v) { setLocal(p=>({...p,[k]:v})); setDirty(true); }

  async function save() { setSaving(true); try { const u=await gc.settings.set(local); setSettings(u); setDirty(false); toast.success('Settings saved'); } catch(e){toast.error(e.message);} finally{setSaving(false);} }
  async function reset() { if (!window.confirm('Reset all settings to defaults?')) return; const d=await gc.settings.reset(); setSettings(d); setLocal({...d}); setDirty(false); toast('Settings reset'); }
  async function detectJava() { setDetectingJava(true); try { const l=await gc.settings.detectJava(); setJavaList(l); toast.success(`Found ${l.length} Java install${l.length!==1?'s':''}`); } catch(e){toast.error(e.message);} finally{setDetectingJava(false);} }
  async function browseJava() { const r=await gc.dialog.openFile({title:'Select Java Executable',filters:[{name:'Java',extensions:['exe','']}]}); if (!r.canceled&&r.filePaths[0]) upd('javaPath',r.filePaths[0]); }

  if (!local) return <div className="flex items-center justify-center h-full"><RefreshCw size={20} className="animate-spin text-gold-500"/></div>;

  const ramIdx = RAM_STEPS.indexOf(local.ram) === -1 ? 3 : RAM_STEPS.indexOf(local.ram);
  const ramPct = sysInfo ? Math.round((local.ram/sysInfo.totalMB)*100) : 0;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-8 pt-6 pb-4 border-b border-dark-800/60 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div><h1 className="section-title">Settings</h1><p className="section-subtitle">Launcher & performance configuration</p></div>
          <div className="flex items-center gap-3">
            <button onClick={reset} className="btn-ghost flex items-center gap-2 text-sm"><RotateCcw size={13}/>Reset</button>
            <button onClick={save} disabled={!dirty||saving} className="btn-gold flex items-center gap-2"><Save size={14}/>{saving?'Saving...':dirty?'Save Changes':'Saved'}</button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        <Section icon={<MemoryStick size={16} className="text-gold-400"/>} title="Memory">
          <div>
            <div className="flex items-end justify-between mb-3">
              <div><label className="label">RAM Allocation</label><div className="flex items-baseline gap-1.5"><span className="font-display text-3xl font-bold text-gold-400">{(local.ram/1024).toFixed(1)}</span><span className="text-dark-400 text-sm">GB</span><span className="text-dark-600 text-xs ml-2">of {sysInfo?(sysInfo.totalMB/1024).toFixed(0):'?'}GB</span></div></div>
              {sysInfo&&<div className="text-right text-xs"><span className={`font-medium ${ramPct>80?'text-red-400':ramPct>60?'text-yellow-400':'text-green-400'}`}>{ramPct}% of system RAM</span><p className="text-dark-600 mt-0.5">Suggested: {(sysInfo.suggestedMB/1024).toFixed(1)}GB</p></div>}
            </div>
            <input type="range" min={0} max={RAM_STEPS.length-1} value={ramIdx} onChange={e=>upd('ram',RAM_STEPS[parseInt(e.target.value)])} className="w-full h-2 rounded-full appearance-none cursor-pointer" style={{background:`linear-gradient(to right,#f59e0b ${(ramIdx/(RAM_STEPS.length-1))*100}%,#242424 0%)`}} />
            <div className="flex justify-between text-dark-700 text-[10px] mt-1"><span>512MB</span><span>4GB</span><span>8GB</span><span>16GB</span></div>
            {ramPct>75&&<div className="flex items-center gap-2 mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-400 text-xs"><AlertTriangle size={13}/>High RAM allocation may cause OS instability. Keep at least 2GB free.</div>}
          </div>
        </Section>

        <Section icon={<Cpu size={16} className="text-blue-400"/>} title="Java">
          <div className="space-y-3">
            <div><label className="label">Java Path (blank for auto-detect)</label><div className="flex gap-2"><input className="input flex-1 text-xs font-mono" placeholder="Auto-detect (recommended)" value={local.javaPath||''} onChange={e=>upd('javaPath',e.target.value)}/><button onClick={browseJava} className="btn-ghost flex-shrink-0 px-3"><FolderOpen size={14}/></button></div></div>
            <button onClick={detectJava} disabled={detectingJava} className="btn-ghost flex items-center gap-2 text-sm">{detectingJava?<><RefreshCw size={13} className="animate-spin"/>Detecting...</>:<><RefreshCw size={13}/>Detect Installations</>}</button>
            {javaList.length>0&&<div className="space-y-1.5">{javaList.map(j=><button key={j.path} onClick={()=>upd('javaPath',j.path)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-all ${local.javaPath===j.path?'border-gold-500/40 bg-gold-500/8 text-gold-300':'border-dark-700 bg-dark-900/50 text-dark-300 hover:border-dark-600'}`}><div className="text-left min-w-0"><p className="font-medium">Java {j.major} <span className="text-xs font-normal">({j.version})</span></p><p className="text-[11px] text-dark-600 truncate">{j.path}</p></div><div className="flex gap-1.5 flex-shrink-0">{j.is64bit&&<span className="badge-blue text-[10px]">64-bit</span>}<span className="badge-gray text-[10px]">{j.vendor.split(' ')[0]}</span></div></button>)}</div>}
          </div>
        </Section>

        <Section icon={<Monitor size={16} className="text-purple-400"/>} title="Display">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Width</label><input type="number" className="input" value={local.resolution?.width||1280} min={640} max={7680} onChange={e=>upd('resolution',{...local.resolution,width:parseInt(e.target.value)})}/></div>
            <div><label className="label">Height</label><input type="number" className="input" value={local.resolution?.height||720} min={480} max={4320} onChange={e=>upd('resolution',{...local.resolution,height:parseInt(e.target.value)})}/></div>
          </div>
          <div className="flex gap-2 flex-wrap mt-2">{[['1280×720','HD'],['1920×1080','FHD'],['2560×1440','QHD'],['3840×2160','4K']].map(([res,label])=>{const[w,h]=res.split('×').map(Number);const active=local.resolution?.width===w&&local.resolution?.height===h;return<button key={res} onClick={()=>upd('resolution',{width:w,height:h})} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${active?'bg-gold-500 text-dark-950':'bg-dark-800 text-dark-400 hover:text-dark-200 border border-dark-700'}`}>{label} <span className="opacity-60 ml-1">{res}</span></button>;})}</div>
        </Section>

        <Section icon={<Zap size={16} className="text-green-400"/>} title="Performance">
          <div className="space-y-3">
            <Toggle label="Performance Mode" description="Enables Aikar's optimized JVM flags for maximum FPS" checked={local.performanceMode!==false} onChange={v=>upd('performanceMode',v)}/>
            <div><label className="label">Extra JVM Arguments</label><textarea className="input resize-none font-mono text-xs" rows={3} placeholder="-XX:+OptimizeStringConcat -Djava.awt.headless=false" value={local.jvmArgs||''} onChange={e=>upd('jvmArgs',e.target.value)}/></div>
            {jvmPreview.length>0&&<div><label className="label">Applied JVM Flags Preview</label><div className="bg-dark-950 rounded-xl p-3 border border-dark-800 max-h-28 overflow-y-auto">{jvmPreview.map((f,i)=><p key={i} className="font-mono text-[10px] text-green-400/80 leading-5">{f}</p>)}</div></div>}
          </div>
        </Section>

        <Section icon={<Settings2 size={16} className="text-orange-400"/>} title="Launcher">
          <div className="space-y-3">
            <Toggle label="Minimize on Launch" description="Minimize launcher window when Minecraft starts" checked={local.closeOnLaunch||false} onChange={v=>upd('closeOnLaunch',v)}/>
            <Toggle label="Show Game Console" description="Open console window with game output when playing" checked={local.showConsole||false} onChange={v=>upd('showConsole',v)}/>
            <Toggle label="Auto-Update" description="Automatically check for Gold Client updates" checked={local.autoUpdate!==false} onChange={v=>upd('autoUpdate',v)}/>
          </div>
        </Section>
      </div>
      {dirty&&<motion.div initial={{y:60}} animate={{y:0}} className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 px-5 py-3 bg-dark-800 border border-dark-700 rounded-2xl shadow-dark z-20"><span className="text-dark-300 text-sm">You have unsaved changes</span><button onClick={reset} className="btn-ghost text-sm">Discard</button><button onClick={save} disabled={saving} className="btn-gold text-sm">{saving?'Saving...':'Save'}</button></motion.div>}
    </div>
  );
}
