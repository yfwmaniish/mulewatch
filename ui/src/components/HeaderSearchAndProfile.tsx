'use client';

import React, { useState } from 'react';
import { useAlerts } from '@/context/AlertContext';
import { Search, Mail, Bell, Activity, AlertTriangle, X, ShieldCheck, FileText, Server, Clock, Hash } from 'lucide-react';

export default function HeaderSearchAndProfile() {
  const { alerts, setCurrentView, setSelectedAlertId, showToast, apiStatus, modelVersion, pendingRetrainCount, totalProcessedCount, trueMulesCount, blockedAccounts } = useAlerts();
  const [fiuOpen, setFiuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchVal.trim()) return;

    // Search alerts for matching ID or customer name
    const match = alerts.find(
      (a) =>
        a.accountId.toLowerCase().includes(searchVal.toLowerCase()) ||
        a.customerName.toLowerCase().includes(searchVal.toLowerCase())
    );

    if (match) {
      setSelectedAlertId(match.accountId);
      setCurrentView('triage');
      setSearchVal('');
      setShowDropdown(false);
    } else {
      showToast(`No active alert matching "${searchVal}" was found.`, 'warning');
    }
  };

  const handleAlertClick = (id: string) => {
    setSelectedAlertId(id);
    setCurrentView('triage');
    setSearchVal('');
    setShowDropdown(false);
  };

  // Filter alerts based on searchVal for a small dynamic dropdown
  const filteredSearchAlerts = alerts.filter(
    (a) =>
      searchVal.trim() !== '' &&
      (a.accountId.toLowerCase().includes(searchVal.toLowerCase()) ||
        a.customerName.toLowerCase().includes(searchVal.toLowerCase()))
  );

  return (
    <header className="flex items-center justify-between w-full relative z-40 select-none bg-transparent">
      {/* Pill Search Input */}
      <div className="relative w-80">
        <form onSubmit={handleSearchSubmit} className="flex items-center bg-white rounded-full border border-slate-200/80 px-4 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-slate-350 transition-all w-full">
          <Search className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Search account hash or name..."
            value={searchVal}
            onChange={(e) => {
              setSearchVal(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            className="bg-transparent text-xs text-slate-800 outline-none w-full placeholder:text-slate-400 placeholder:font-sans font-mono"
          />
          <span className="text-[10px] text-slate-400 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60 font-bold shadow-sm select-none shrink-0 ml-2">
            ⌘F
          </span>
        </form>

        {/* Dynamic Search Dropdown */}
        {showDropdown && filteredSearchAlerts.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200/80 rounded-2xl shadow-xl overflow-hidden z-50 p-1.5">
            <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest px-2.5 py-1">
              Active Triage Matches
            </div>
            {filteredSearchAlerts.map((a) => (
              <button
                key={a.accountId}
                onMouseDown={() => handleAlertClick(a.accountId)}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-50 transition-all flex items-center justify-between text-xs group"
              >
                <div className="truncate pr-2">
                  <div className="font-semibold text-slate-800 truncate">{a.customerName}</div>
                  <div className="text-[9px] text-slate-400 font-mono truncate">{a.accountId}</div>
                </div>
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded shrink-0 ${
                  a.score >= 0.70 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  {(a.score * 100).toFixed(0)}%
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action controls & Investigator Profile element */}
      <div className="flex items-center gap-5">

        {/* Live API status pill */}
        <div
          title={apiStatus === 'online'
            ? `Scoring API healthy · model ${modelVersion.slice(0, 8)}`
            : apiStatus === 'connecting'
              ? 'Connecting to scoring API…'
              : 'Scoring API unreachable — start `python -m uvicorn service.api:app`'}
          className={`hidden md:flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-full border text-[10px] font-mono font-bold tracking-wide ${
            apiStatus === 'online'
              ? 'bg-emerald-50 border-emerald-200 text-[#0F5132]'
              : apiStatus === 'connecting'
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-red-50 border-red-200 text-[#DC2626]'
          }`}
        >
          {apiStatus === 'offline'
            ? <AlertTriangle className="h-3 w-3" />
            : <Activity className={`h-3 w-3 ${apiStatus === 'online' ? '' : 'animate-pulse'}`} />}
          <span>{apiStatus === 'online' ? 'API LIVE' : apiStatus === 'connecting' ? 'CONNECTING' : 'API OFFLINE'}</span>
          {modelVersion && apiStatus === 'online' && (
            <span className="text-emerald-700/70 pl-1 border-l border-emerald-200">{modelVersion.slice(0, 8)}</span>
          )}
        </div>

        {/* Compliance Incoming regulatory notification ticks */}
        <div className="flex items-center gap-2.5">
          <button
            className="h-10 w-10 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:scale-105 active:scale-95 relative"
            title="FIU-IND / I4C feed status"
            onClick={() => setFiuOpen(true)}
          >
            <Mail className="h-4 w-4" />
            <span className="absolute top-0 right-0 h-2.5 w-2.5 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
          </button>

          <button
            className="h-10 w-10 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:scale-105 active:scale-95 relative"
            title={`${alerts.length} active triage alerts · click to open queue`}
            onClick={() => setBellOpen((v) => !v)}
          >
            <Bell className="h-4 w-4" />
            {alerts.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-red-500 text-white rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold shadow-sm">
                {alerts.length > 99 ? '99+' : alerts.length}
              </span>
            )}
          </button>
        </div>

        {/* Profile Card */}
        <button
          onClick={() => setProfileOpen(true)}
          className="flex items-center gap-3 bg-white border border-slate-200/80 hover:border-slate-300 pl-3 pr-4 py-1.5 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all hover:scale-[1.01] active:scale-[0.99]"
        >
          <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-[#0F5132] to-[#419E73] flex items-center justify-center text-white font-semibold font-mono text-xs shadow-sm ring-2 ring-emerald-100 relative shrink-0">
            DA
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-emerald-500 rounded-full border-2 border-white" />
          </div>
          <div className="text-left select-none">
            <div className="text-xs font-bold text-slate-800 leading-tight">Demo Analyst</div>
            <div className="text-[10px] text-slate-400 font-medium font-sans">demo-analyst@psb-iith</div>
          </div>
        </button>
      </div>

      {/* ====== Bell popover (top-right alerts dropdown) ====== */}
      {bellOpen && (
        <div className="absolute top-[3.5rem] right-[8rem] w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-3 max-h-[28rem] overflow-y-auto font-sans">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-800">Recent alerts</span>
            <button onClick={() => setBellOpen(false)} className="text-slate-400 hover:text-slate-700 p-0.5"><X className="h-3.5 w-3.5" /></button>
          </div>
          {alerts.slice(0, 8).map((a) => (
            <button
              key={a.accountId}
              onClick={() => { setSelectedAlertId(a.accountId); setCurrentView('triage'); setBellOpen(false); }}
              className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 text-left"
            >
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-slate-800 truncate">{a.customerName}</div>
                <div className="font-mono text-[9px] text-slate-400 truncate">{a.accountId}</div>
              </div>
              <span className={`shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded ${
                a.riskBand === 'Hard Hit' ? 'bg-fuchsia-50 text-[#A21CAF]' :
                a.riskBand === 'High' ? 'bg-red-50 text-[#DC2626]' :
                a.riskBand === 'Medium' ? 'bg-amber-50 text-amber-700' :
                'bg-emerald-50 text-[#0F5132]'
              }`}>{(a.score * 100).toFixed(0)}%</span>
            </button>
          ))}
          <button
            onClick={() => { setCurrentView('alerts'); setBellOpen(false); }}
            className="w-full mt-2 py-1.5 text-[10px] font-bold text-[#0F5132] hover:bg-emerald-50 rounded-lg"
          >
            View all {alerts.length} alerts →
          </button>
        </div>
      )}

      {/* ====== FIU / I4C feed modal ====== */}
      {fiuOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" onClick={() => setFiuOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/40" />
          <div onClick={(e) => e.stopPropagation()} className="relative bg-white max-w-md w-full rounded-3xl shadow-2xl overflow-hidden border border-slate-200 font-sans animate-fadeIn">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-[#0F5132]/10 text-[#0F5132] flex items-center justify-center"><ShieldCheck className="h-4 w-4" /></div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Regulatory feeds</h3>
                  <p className="text-[10px] text-slate-500">Live status of upstream watchlists</p>
                </div>
              </div>
              <button onClick={() => setFiuOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-2 text-xs">
              <FeedRow label="I4C / CFCFRMS" detail={`Active · ${blockedAccounts.length} hard-blocks in session`} ok />
              <FeedRow label="FIU-IND watchlist" detail="Active · scheduled sync every 5 min" ok />
              <FeedRow label="RBI master direction feed" detail="Active · last refresh < 1 h ago" ok />
              <FeedRow label="Scoring API" detail={apiStatus === 'online' ? `Online · model ${modelVersion.slice(0, 8)}` : 'Offline'} ok={apiStatus === 'online'} />
            </div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 grid grid-cols-3 gap-3 text-center">
              <Stat label="Pending retrain" value={pendingRetrainCount} />
              <Stat label="Hard-blocks (session)" value={blockedAccounts.length} />
              <Stat label="Confirmed mules" value={trueMulesCount} />
            </div>
          </div>
        </div>
      )}

      {/* ====== Analyst profile modal ====== */}
      {profileOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" onClick={() => setProfileOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/40" />
          <div onClick={(e) => e.stopPropagation()} className="relative bg-white max-w-md w-full rounded-3xl shadow-2xl overflow-hidden border border-slate-200 font-sans animate-fadeIn">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-[#0F5132] to-[#419E73] flex items-center justify-center text-white font-bold font-mono shadow-md ring-2 ring-emerald-100">DA</div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Demo Analyst</h3>
                  <p className="text-[10px] text-slate-500 font-mono">demo-analyst@psb-iith</p>
                </div>
              </div>
              <button onClick={() => setProfileOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <Row icon={<Server className="h-3.5 w-3.5" />} label="Scoring API" value={apiStatus === 'online' ? 'Online' : 'Offline'} />
              <Row icon={<Hash className="h-3.5 w-3.5" />} label="Model version" value={modelVersion || '—'} mono />
              <Row icon={<FileText className="h-3.5 w-3.5" />} label="Active alerts" value={String(alerts.length)} />
              <Row icon={<Clock className="h-3.5 w-3.5" />} label="Accounts monitored" value={totalProcessedCount.toLocaleString()} />
              <Row icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Retrain queue depth" value={String(pendingRetrainCount)} />
            </div>
            <div className="p-5 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-500">
              Demo session · sign-off triggers the lockscreen overlay. No real authentication is configured for this hackathon submission.
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function FeedRow({ label, detail, ok }: { label: string; detail: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">
      <span className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`} />
      <span className="font-bold text-slate-700 text-xs">{label}</span>
      <span className="text-slate-500 ml-auto text-[10px] font-mono truncate max-w-[55%] text-right">{detail}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wide text-slate-400 font-bold">{label}</div>
      <div className="text-base font-mono font-bold text-slate-800 mt-0.5">{value}</div>
    </div>
  );
}

function Row({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200/60">
      <span className="text-slate-400">{icon}</span>
      <span className="text-slate-600">{label}</span>
      <span className={`ml-auto text-slate-800 font-semibold ${mono ? 'font-mono text-[10px]' : 'text-xs'}`}>{value}</span>
    </div>
  );
}
