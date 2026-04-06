import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Layers, Package, Settings, Terminal, ChevronLeft, ChevronRight, LogOut, User, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import useStore from '../store/useStore';
import clsx from 'clsx';
const gc = window.goldClient;

const NAV = [
  { to:'/',          icon:Home,     label:'Home'      },
  { to:'/instances', icon:Layers,   label:'Instances' },
  { to:'/mods',      icon:Package,  label:'Mods'      },
  { to:'/console',   icon:Terminal, label:'Console'   },
  { to:'/settings',  icon:Settings, label:'Settings'  },
];

function fmtPlaytime(s) { if(s<60) return '<1m played'; if(s<3600) return `${Math.floor(s/60)}m played`; return `${(s/3600).toFixed(1)}h played`; }

export default function Sidebar() {
  const { auth, setAuth, sidebarCollapsed, setSidebarCollapsed, instances, runningInstances } = useStore();
  const location = useLocation();

  async function logout() { await gc.auth.logout(); setAuth(null); toast('Logged out', { icon:'👋' }); }

  return (
    <motion.aside animate={{ width: sidebarCollapsed ? 64 : 220 }} transition={{ duration:0.25, ease:'easeInOut' }}
      className="flex flex-col bg-dark-900 border-r border-dark-800 flex-shrink-0 overflow-hidden relative z-10">

      <div className="flex flex-col gap-1 px-2 pt-3 flex-1 min-h-0 overflow-y-auto no-scrollbar">
        {/* Brand */}
        <div className={clsx('flex items-center gap-3 px-2 py-3 mb-2', sidebarCollapsed && 'justify-center')}>
          <div className="w-8 h-8 bg-gold-gradient rounded-lg flex items-center justify-center flex-shrink-0 shadow-gold">
            <span className="font-display font-bold text-dark-950">G</span>
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-8}} transition={{duration:0.15}}>
                <p className="font-display font-bold text-sm text-gradient-gold tracking-widest uppercase leading-none">Gold Client</p>
                <p className="text-dark-500 text-[10px] mt-0.5">v1.0.0</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Running badge */}
        {runningInstances.size > 0 && (
          <div className={clsx('mb-1 px-2 py-1.5 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-2', sidebarCollapsed && 'justify-center')}>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-green-400 text-xs font-medium">{runningInstances.size} Running</span>}
          </div>
        )}

        {/* Nav */}
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ to, icon:Icon, label }) => {
            const active = location.pathname === to;
            return (
              <NavLink key={to} to={to} className={clsx(active ? 'nav-item-active' : 'nav-item', sidebarCollapsed && 'justify-center px-2')} title={sidebarCollapsed ? label : undefined}>
                <Icon size={18} className="flex-shrink-0" />
                <AnimatePresence>
                  {!sidebarCollapsed && <motion.span initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-8}} transition={{duration:0.15}} className="text-sm">{label}</motion.span>}
                </AnimatePresence>
                {active && <motion.div layoutId="nav-indicator" className="ml-auto w-1 h-4 bg-gold-500 rounded-full flex-shrink-0" style={{display:sidebarCollapsed?'none':'block'}} />}
              </NavLink>
            );
          })}
        </nav>

        {/* Quick stats */}
        {!sidebarCollapsed && instances.length > 0 && (
          <div className="mt-2 px-2">
            <div className="bg-dark-800/60 rounded-xl p-3 border border-dark-700/50">
              <p className="text-dark-500 text-[10px] uppercase tracking-wider font-medium mb-2">Quick Stats</p>
              <div className="flex items-center gap-2 text-dark-400 text-xs mb-1"><Layers size={12} /><span>{instances.length} instance{instances.length!==1?'s':''}</span></div>
              <div className="flex items-center gap-2 text-dark-400 text-xs"><Clock size={12} /><span>{fmtPlaytime(instances.reduce((a,i)=>a+(i.playTime||0),0))}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom */}
      <div className="px-2 pb-3 mt-auto">
        <div className={clsx('flex items-center gap-2.5 px-2 py-2 mb-2 rounded-xl bg-dark-800/40 border border-dark-700/50', sidebarCollapsed && 'justify-center')}>
          <div className="w-7 h-7 bg-gold-500/20 border border-gold-500/30 rounded-full flex items-center justify-center flex-shrink-0">
            <User size={14} className="text-gold-400" />
          </div>
          {!sidebarCollapsed && <>
            <div className="flex-1 min-w-0"><p className="text-dark-100 text-xs font-medium truncate">{auth?.username}</p><p className="text-dark-500 text-[10px] capitalize">{auth?.type} account</p></div>
            <button onClick={logout} className="text-dark-500 hover:text-red-400 transition-colors p-0.5" title="Logout"><LogOut size={13} /></button>
          </>}
        </div>
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={clsx('w-full flex items-center gap-2 px-2 py-2 rounded-xl text-dark-500 hover:text-dark-300 hover:bg-dark-800 transition-all text-xs', sidebarCollapsed && 'justify-center')}>
          {sidebarCollapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /><span>Collapse</span></>}
        </button>
      </div>
    </motion.aside>
  );
}
