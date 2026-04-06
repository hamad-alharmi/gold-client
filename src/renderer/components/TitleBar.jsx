import React from 'react';
import { Minus, Square, X } from 'lucide-react';
import useStore from '../store/useStore';
const gc = window.goldClient;

export default function TitleBar() {
  const isMaximized = useStore(s => s.isMaximized);
  return (
    <div className="drag-region flex items-center justify-between h-10 px-3 bg-dark-950/95 border-b border-dark-800/60 z-50 flex-shrink-0">
      <div className="no-drag flex items-center gap-2.5">
        <div className="w-5 h-5 bg-gold-gradient rounded flex items-center justify-center">
          <span className="font-display text-xs font-bold text-dark-950">G</span>
        </div>
        <span className="font-display text-sm font-semibold text-dark-200 tracking-widest uppercase">Gold Client</span>
      </div>
      <div className="flex-1" />
      <div className="no-drag flex items-center">
        <TBtn onClick={() => gc.app.minimize()} label="Minimize" icon={<Minus size={12} />} />
        <TBtn onClick={() => gc.app.maximize()} label={isMaximized?'Restore':'Maximize'} icon={isMaximized?<span className="text-[10px] font-bold">❐</span>:<Square size={11} />} />
        <TBtn onClick={() => gc.app.quit()} label="Close" icon={<X size={13} />} danger />
      </div>
    </div>
  );
}

function TBtn({ onClick, label, icon, danger }) {
  return (
    <button onClick={onClick} aria-label={label}
      className={`w-10 h-10 flex items-center justify-center transition-all text-dark-400 hover:text-dark-100 ${danger ? 'hover:bg-red-500/80 hover:text-white' : 'hover:bg-dark-700'}`}>
      {icon}
    </button>
  );
}
