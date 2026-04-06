import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Trash2, ChevronDown, Download, Search } from 'lucide-react';
import useStore from '../store/useStore';

export default function Console() {
  const { instances, gameLogs, clearGameLogs, runningInstances } = useStore();
  const [selectedId,setSelectedId]=useState(instances[0]?.id||null), [filter,setFilter]=useState('');
  const [autoScroll,setAutoScroll]=useState(true);
  const bottomRef=useRef(null), containerRef=useRef(null);
  const logs = gameLogs[selectedId]||[];
  const filtered = filter ? logs.filter(l=>l.toLowerCase().includes(filter.toLowerCase())) : logs;

  useEffect(() => { if (autoScroll&&bottomRef.current) bottomRef.current.scrollIntoView({behavior:'smooth'}); }, [filtered.length,autoScroll]);
  function onScroll() { const el=containerRef.current; if (!el) return; setAutoScroll(el.scrollHeight-el.scrollTop-el.clientHeight<50); }
  function download() { const blob=new Blob([logs.join('\n')],{type:'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`gold-client-log-${selectedId}.txt`; a.click(); }
  function lineColor(l) { const lo=l.toLowerCase(); if (lo.includes('error')||lo.includes('exception')||lo.includes('crash')) return 'text-red-400'; if (lo.includes('warn')) return 'text-yellow-400'; if (lo.includes('info')) return 'text-dark-200'; if (lo.includes('debug')) return 'text-dark-600'; return 'text-dark-300'; }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-8 pt-6 pb-4 border-b border-dark-800/60 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div><h1 className="section-title">Console</h1><p className="section-subtitle">{selectedId&&runningInstances.has(selectedId)?<><span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse mr-1.5"/>Game running · {logs.length} lines</>:`${logs.length} log lines`}</p></div>
          {logs.length>0&&<div className="flex items-center gap-2">
            <button onClick={download} className="btn-ghost flex items-center gap-2 text-sm"><Download size={13}/>Export</button>
            <button onClick={()=>clearGameLogs(selectedId)} className="btn-ghost flex items-center gap-2 text-sm text-dark-500"><Trash2 size={13}/>Clear</button>
          </div>}
        </div>
        <div className="flex gap-3">
          <select className="input h-9 text-sm appearance-none bg-dark-900 cursor-pointer w-48" value={selectedId||''} onChange={e=>setSelectedId(e.target.value)}>
            {instances.map(i=><option key={i.id} value={i.id}>{i.name}{runningInstances.has(i.id)?' \ud83d\udfe2':''}</option>)}
          </select>
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500"/>
            <input className="input pl-8 h-9 text-sm" placeholder="Filter logs..." value={filter} onChange={e=>setFilter(e.target.value)}/>
          </div>
        </div>
      </div>
      <div ref={containerRef} onScroll={onScroll} className="flex-1 overflow-y-auto bg-dark-950 p-4 font-mono text-xs leading-5">
        {filtered.length===0 ? <div className="flex flex-col items-center justify-center h-full text-dark-700"><Terminal size={28} className="mb-3"/><p>{logs.length===0?'No logs yet — launch a game to see output':'No lines match filter'}</p></div>
          : filtered.map((line,i)=><div key={i} className={`${lineColor(line)} leading-5 whitespace-pre-wrap break-words`}>{line}</div>)
        }
        <div ref={bottomRef}/>
      </div>
      {!autoScroll&&<button onClick={()=>{setAutoScroll(true);bottomRef.current?.scrollIntoView({behavior:'smooth'});}} className="absolute bottom-6 right-8 flex items-center gap-2 px-3 py-2 bg-dark-800 border border-dark-700 rounded-xl text-xs text-dark-300 hover:text-dark-100 transition-colors shadow-dark"><ChevronDown size={13}/>Jump to bottom</button>}
    </div>
  );
}
