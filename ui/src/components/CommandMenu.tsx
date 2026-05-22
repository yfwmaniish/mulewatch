'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { useAlerts } from '@/context/AlertContext';
import { 
  Search, 
  Terminal, 
  ShieldAlert, 
  LayoutDashboard, 
  Download, 
  Lock, 
  RotateCw,
  Pin,
  X,
  Activity,
  Cpu,
  CornerDownLeft
} from 'lucide-react';

interface TerminalLog {
  timestamp: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'SYS';
  message: string;
}

export default function CommandMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const { 
    alerts, 
    executeSystemBlock, 
    markAsFalsePositive, 
    eventsPerSecond, 
    totalProcessedCount,
    currentView,
    setCurrentView,
    selectedAlertId,
    setSelectedAlertId,
    setIsModelCardOpen
  } = useAlerts();

  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  // Custom terminal logs for premium execution feedback
  const [logs, setLogs] = useState<TerminalLog[]>([
    { timestamp: '23:45:01', type: 'SYS', message: 'AEGIS Control Deck online' },
    { timestamp: '23:45:02', type: 'INFO', message: 'Ledger Audit Core active (v1.02)' }
  ]);

  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Toggle Deck with Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => {
          const next = !prev;
          if (!next) setIsPinned(false); // Unpin if closing
          return next;
        });
        setSearch('');
        setSelectedIndex(0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when deck opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Click outside to close (only if NOT pinned)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isPinned) return;
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        // If clicking layout toggle button, ignore
        const clickedHeaderBtn = (e.target as HTMLElement).closest('button')?.innerText?.includes('ANALYST DECK');
        if (!clickedHeaderBtn) {
          setIsOpen(false);
        }
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isPinned]);

  // Scroll terminal logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Listen for custom trigger event from header button
  useEffect(() => {
    const handleOpenDeck = () => {
      setIsOpen((prev) => !prev);
      setSearch('');
      setSelectedIndex(0);
    };
    window.addEventListener('toggle-analyst-deck', handleOpenDeck);
    return () => window.removeEventListener('toggle-analyst-deck', handleOpenDeck);
  }, []);

  const addLog = (type: 'INFO' | 'SUCCESS' | 'WARNING' | 'SYS', message: string) => {
    const now = new Date();
    const timeStr = now.toTimeString().substring(0, 8);
    setLogs((prev) => [...prev, { timestamp: timeStr, type, message }]);
  };

  // Active account context (Page 3 detail)
  const currentAccountId = useMemo(() => {
    if (currentView === 'triage' && selectedAlertId) {
      return selectedAlertId;
    }
    return null;
  }, [currentView, selectedAlertId]);

  // Commands and options filtered list
  const commandItems = useMemo(() => {
    const items = [];

    // Category 1: Navigation commands
    items.push({
      category: 'Navigation',
      name: 'Go to Dashboard',
      description: 'Navigate to Executive Management Dashboard',
      icon: LayoutDashboard,
      action: () => {
        addLog('SYS', 'Routing to Dashboard SPA view...');
        setCurrentView('dashboard');
      }
    });
    items.push({
      category: 'Navigation',
      name: 'Go to Alerts Queue',
      description: 'Review active high-velocity alerts',
      icon: ShieldAlert,
      action: () => {
        addLog('SYS', 'Routing to Alerts Queue SPA view...');
        setCurrentView('alerts');
      }
    });

    // Category 2: Contextual Triage Actions
    if (currentAccountId) {
      items.push({
        category: 'Triage Actions (Active Account)',
        name: `Block Credit: ${currentAccountId.substring(0, 12)}...`,
        description: 'Enforce instant system block, draft STR',
        icon: Lock,
        action: () => {
          executeSystemBlock(currentAccountId);
          addLog('WARNING', `Credit freeze initialized for ${currentAccountId.substring(0, 16)}...`);
        }
      });
      items.push({
        category: 'Triage Actions (Active Account)',
        name: `Save Safe Override: ${currentAccountId.substring(0, 12)}...`,
        description: 'Authorize safe override, record nodal bypass logs',
        icon: RotateCw,
        action: () => {
          markAsFalsePositive(currentAccountId);
          addLog('SUCCESS', `Account ${currentAccountId.substring(0, 16)}... safe override recorded`);
          setCurrentView('alerts');
        }
      });
    }

    // Category 3: Compliance Tools
    items.push({
      category: 'Compliance Rules',
      name: 'Download RBI Draft Card',
      description: 'Verify Securities & Nodal Compliance parameters',
      icon: Download,
      action: () => {
        setIsModelCardOpen(true);
      }
    });

    // Category 4: Dynamic Search of accounts alerts
    const searchLower = search.toLowerCase();
    const matchedAlerts = alerts.filter(
      (a) =>
          a.accountId.toLowerCase().includes(searchLower) ||
          a.customerName.toLowerCase().includes(searchLower)
    );

    matchedAlerts.forEach((alert) => {
      items.push({
        category: 'Triage Queue Search',
        name: `Inspect: ${alert.customerName}`,
        description: `Score ${(alert.score * 100).toFixed(0)}% | ${alert.accountId.substring(0, 12)}...`,
        icon: Activity,
        action: () => {
          addLog('SYS', `Opening inspection for ${alert.customerName}`);
          setSelectedAlertId(alert.accountId);
          setCurrentView('triage');
        }
      });
    });

    if (!search.trim()) return items;

    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(searchLower) ||
        item.category.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower)
    );
  }, [search, currentAccountId, alerts, router, executeSystemBlock, markAsFalsePositive]);

  // Handle key triggers for list scrolling
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % commandItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + commandItems.length) % commandItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (commandItems[selectedIndex]) {
        commandItems[selectedIndex].action();
        setSearch('');
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setIsPinned(false);
    }
  };

  // Custom text-command parsing when hitting enter on empty command suggestions
  const handleCustomCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;

    const query = search.trim().toLowerCase();
    setSearch('');

    if (query === 'dashboard' || query === 'goto dashboard') {
      addLog('SYS', 'Executing goto dashboard...');
      setCurrentView('dashboard');
    } else if (query === 'alerts' || query === 'goto alerts') {
      addLog('SYS', 'Executing goto alerts...');
      setCurrentView('alerts');
    } else if (query === 'block' && currentAccountId) {
      executeSystemBlock(currentAccountId);
      addLog('WARNING', `CLI Override: Credit freeze initialized for ${currentAccountId.substring(0, 16)}...`);
    } else if (query === 'override' && currentAccountId) {
      markAsFalsePositive(currentAccountId);
      addLog('SUCCESS', `CLI Override: Authorizing bypass for ${currentAccountId.substring(0, 16)}...`);
      setCurrentView('alerts');
    } else if (query === 'clear') {
      setLogs([]);
    } else if (query === 'pin') {
      setIsPinned(true);
      addLog('INFO', 'Control deck pinned to workspace grid');
    } else if (query === 'unpin') {
      setIsPinned(false);
      addLog('INFO', 'Control deck unpinned');
    } else {
      addLog('WARNING', `Unknown command: "${query}"`);
    }
  };

  if (!isOpen) return null;

  return (
    <aside 
      ref={panelRef}
      onKeyDown={handleKeyDown}
      className={`bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 transition-all duration-300 z-40 select-none ${
        isPinned 
          ? 'relative w-80 h-screen text-slate-100'
          : 'fixed top-0 right-0 w-80 h-screen shadow-2xl text-slate-100 z-50'
      }`}
    >
      {/* Deck Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-indigo-400" />
          <h2 className="text-xs font-bold font-mono tracking-wider uppercase text-white">Analyst Control Deck</h2>
        </div>
        
        <div className="flex items-center gap-1.5">
          {/* Pinned toggle */}
          <button 
            onClick={() => {
              setIsPinned(!isPinned);
              addLog('INFO', !isPinned ? 'Control deck pinned static' : 'Control deck unpinned overlay');
            }}
            className={`p-1.5 rounded transition-colors ${
              isPinned ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-500 hover:text-white border border-transparent'
            }`}
            title={isPinned ? 'Unpin Sidebar' : 'Pin to Workspace'}
          >
            <Pin className="h-3.5 w-3.5" />
          </button>
          
          <button 
            onClick={() => {
              setIsOpen(false);
              setIsPinned(false);
            }}
            className="p-1.5 text-slate-500 hover:text-white rounded hover:bg-slate-800 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Stats Ticker */}
      <div className="p-3 bg-slate-950/30 border-b border-slate-800 flex justify-between items-center text-[10px] font-mono text-slate-400">
        <div className="flex items-center gap-1">
          <Activity className="h-3.5 w-3.5 text-emerald-500" />
          <span>{eventsPerSecond} REC/S</span>
        </div>
        <div className="text-slate-600">|</div>
        <div className="flex items-center gap-1">
          <Cpu className="h-3.5 w-3.5 text-indigo-400" />
          <span>N: {totalProcessedCount.toLocaleString()}</span>
        </div>
      </div>

      {/* Command Search / Shell Input */}
      <div className="p-3 border-b border-slate-800 bg-slate-950/40">
        <form onSubmit={handleCustomCommandSubmit} className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded">
          <Search className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type command (e.g. goto dashboard, block)..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-600 font-mono"
          />
          <CornerDownLeft className="h-3 w-3 text-slate-700 shrink-0" />
        </form>
      </div>

      {/* Command Suggestions / Interactive Results */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 border-b border-slate-800">
        {search.trim() && commandItems.length === 0 ? (
          <div className="text-center py-6 text-[10px] font-mono text-slate-600">
            No command matches found. Press Enter to submit CLI overrides.
          </div>
        ) : (
          commandItems.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            const Icon = item.icon;
            const showCategory = idx === 0 || commandItems[idx - 1].category !== item.category;

            return (
              <div key={idx} className="space-y-1">
                {showCategory && (
                  <div className="text-[8px] text-slate-500 font-bold uppercase tracking-widest px-2.5 pt-1.5 pb-0.5 font-mono">
                    {item.category}
                  </div>
                )}
                <button
                  onClick={() => {
                    item.action();
                    setSearch('');
                  }}
                  className={`w-full text-left p-2 rounded flex items-center justify-between transition-colors border ${
                    isSelected 
                      ? 'bg-indigo-650/10 border-indigo-500/30 text-white shadow-inner shadow-black' 
                      : 'border-transparent hover:bg-slate-850 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`} />
                    <div className="truncate">
                      <div className="text-[11px] font-mono font-semibold truncate">
                        {item.name}
                      </div>
                      <div className="text-[9px] text-slate-500 font-sans truncate">
                        {item.description}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="text-[8px] text-slate-500 font-mono font-bold uppercase shrink-0 bg-slate-900 border border-slate-800 px-1 rounded">
                      ↵
                    </span>
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Real-time Dynamic Console Log Terminal */}
      <div className="h-44 bg-slate-950 flex flex-col font-mono text-[9px] text-slate-300 overflow-hidden shrink-0">
        <div className="p-2 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between text-[8px] text-slate-500 font-bold tracking-wider">
          <span>ACTIVE FEEDBACK SHELL</span>
          <button onClick={() => setLogs([])} className="hover:text-white transition-colors">
            CLEAR
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1 select-text scrollbar-thin">
          {logs.map((log, idx) => (
            <div key={idx} className="leading-relaxed">
              <span className="text-slate-600 mr-1.5">[{log.timestamp}]</span>
              <span className={`font-bold mr-1.5 ${
                log.type === 'SUCCESS' ? 'text-emerald-500' :
                log.type === 'WARNING' ? 'text-red-400' :
                log.type === 'SYS' ? 'text-indigo-400' : 'text-slate-400'
              }`}>
                {log.type}
              </span>
              <span className="text-slate-300">{log.message}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </aside>
  );
}
