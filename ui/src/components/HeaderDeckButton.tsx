'use client';

import React from 'react';

export default function HeaderDeckButton() {
  return (
    <button 
      onClick={() => window.dispatchEvent(new CustomEvent('toggle-analyst-deck'))}
      className="flex items-center gap-2 border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 font-mono text-[10px] px-2.5 py-1.5 rounded transition-all cursor-pointer shadow-sm"
    >
      <span>ANALYST DECK</span>
      <span className="text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[8px] font-bold shadow-sm font-sans">
        ⌘K
      </span>
    </button>
  );
}
