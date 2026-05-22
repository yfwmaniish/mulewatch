'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAlerts } from '@/context/AlertContext';
import BehavioralCluster from '@/components/BehavioralCluster';
import { api } from '@/lib/api';
import { parseNumericId } from '@/lib/adapt';
import { 
  ArrowRight, 
  ArrowUpRight, 
  Search, 
  Copy, 
  Check, 
  Clock, 
  ExternalLink,
  ShieldAlert,
  Activity,
  Cpu,
  Users,
  Settings,
  HelpCircle,
  FileDown,
  User,
  MapPin,
  Calendar,
  Smartphone,
  Info,
  CheckCircle,
  AlertTriangle,
  RotateCw,
  Lock,
  FileCheck2,
  ChevronRight,
  Sliders,
  CornerDownRight,
  Pin,
  Maximize2,
  Minimize2,
  X,
  Play,
  Pause,
  FastForward,
  HeartPulse,
  BrainCircuit,
  ShieldCheck,
  CheckSquare,
  Shield
} from 'lucide-react';

// ==========================================
// SLA TIMER COMPONENT
// ==========================================
const SlaTimer: React.FC<{ timestamp: string }> = ({ timestamp }) => {
  const [timeLeft, setTimeLeft] = useState<string>("15:00");
  const [isBreached, setIsBreached] = useState<boolean>(false);

  useEffect(() => {
    const calculateTime = () => {
      const ingestionTime = new Date(timestamp).getTime();
      const fifteenMinutes = 15 * 60 * 1000;
      const targetTime = ingestionTime + fifteenMinutes;
      const now = Date.now();
      const diff = targetTime - now;

      if (diff <= 0) {
        setIsBreached(true);
        const absDiff = Math.abs(diff);
        const overMinutes = Math.floor(absDiff / 60000);
        const overSeconds = Math.floor((absDiff % 60000) / 1000);
        setTimeLeft(`-${overMinutes.toString().padStart(2, '0')}:${overSeconds.toString().padStart(2, '0')}`);
      } else {
        setIsBreached(false);
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [timestamp]);

  return (
    <div className={`flex items-center gap-1.5 font-mono text-xs ${
      isBreached 
        ? 'text-[#DC2626] font-bold animate-pulse' 
        : 'text-slate-500 font-medium'
    }`}>
      <Clock className={`h-3.5 w-3.5 ${isBreached ? 'text-[#DC2626]' : 'text-slate-400'}`} />
      <span>{timeLeft}</span>
      {isBreached && <span className="text-[8px] bg-red-50 text-[#DC2626] border border-red-200 px-1 py-0.5 rounded font-black font-mono shadow-sm">OVER SLA</span>}
    </div>
  );
};

// ==========================================
// COPYABLE ACCOUNT ID COMPONENT
// ==========================================
const CopyableAccountId: React.FC<{ accountId: string }> = ({ accountId }) => {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(accountId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="flex items-center gap-1.5 group cursor-pointer"
      title="Click to Copy Account Hash"
      onClick={handleCopy}
    >
      <span className="font-mono text-xs text-slate-700 group-hover:text-[#0F5132] transition-colors font-bold tracking-wide">
        {accountId.substring(0, 15)}...
      </span>
      <button className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 bg-slate-50 rounded border border-slate-200 hover:bg-slate-100 shadow-sm shrink-0">
        {copied ? (
          <Check className="h-3 w-3 text-[#0F5132]" />
        ) : (
          <Copy className="h-3 w-3 text-slate-400" />
        )}
      </button>
    </div>
  );
};

export default function SPAConsoleContainer() {
  const { 
    alerts, 
    blockedAccounts, 
    pendingRetrainCount, 
    totalProcessedCount, 
    trueMulesCount, 
    streamEvents, 
    eventsPerSecond,
    currentView,
    setCurrentView,
    selectedAlertId,
    setSelectedAlertId,
    markAsFalsePositive,
    executeSystemBlock,
    setIsSettingsOpen,
    setIsHelpOpen,
    setIsModelCardOpen,
    setIsAddNodalOpen,
    setIsCfcOpen,
    setIsBaselineOpen,
    setIsCaptureStatsOpen,
    setIsLockscreenActive,
    analysts,
    recentLogs,
    addRecentLog,
    settings,
    updateSettings,
    toast,
    showToast,
    hideToast
  } = useAlerts();

  // Dynamic Ticker clock
  const [tickerTime, setTickerTime] = useState('01:24:08');
  useEffect(() => {
    const clockInterval = setInterval(() => {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      setTickerTime(timeStr);
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const [tickerActive, setTickerActive] = useState(true);

  // SLA Warnings list target
  const highestRiskAlert = useMemo(() => {
    return alerts.find(a => a.riskBand === 'High' || a.riskBand === 'Hard Hit') || alerts[0];
  }, [alerts]);

  // Topology node states (coordinates mapping, interactive SVG)
  const [topologyNodes, setTopologyNodes] = useState([
    { id: 'SRC', label: 'SOURCE', x: 260, y: 70, r: 24, fill: '#0F5132', details: 'Reported Victim Account (A. Sharma). Initiated dispute within 45 min.', channel: 'IMPS IN', volume: 480290, status: 'REPORTED FRAUD' },
    { id: 'MULE', label: 'MULE', x: 260, y: 200, r: 30, fill: '#DC2626', details: 'Flagged Subject Account (AEGIS TARGET). Coordinates rapid split fan-out.', channel: 'Primary IN', volume: 480290, status: 'SUSPECTED MULE' },
    { id: 'B1', label: 'B1', x: 80, y: 150, r: 20, fill: '#64748B', details: 'UPI Beneficiary. Instant split routing (Suresh Gupta).', channel: 'UPI', volume: 120000, status: 'HIGH VELOCITY' },
    { id: 'B2', label: 'B2', x: 440, y: 150, r: 20, fill: '#64748B', details: 'NEFT Destination. Newly linked within 24 hours (Pooja Mehta).', channel: 'NEFT', volume: 85000, status: 'NEW LINKING' },
    { id: 'B3', label: 'B3', x: 80, y: 310, r: 20, fill: '#64748B', details: 'IMPS Endpoint. High frequency payouts (Rajesh Kumar).', channel: 'IMPS', volume: 68000, status: 'MULTIPLE CLUSTERS' },
    { id: 'B4', label: 'B4', x: 440, y: 310, r: 20, fill: '#64748B', details: 'RTGS Cash Out. Final exit node (Shell Corp Ltd).', channel: 'RTGS', volume: 207290, status: 'CRITICAL HIGH VALUE' }
  ]);

  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedTopologyNode, setSelectedTopologyNode] = useState<any>(topologyNodes[1]);
  const [isFS, setIsFS] = useState(false);

  // Nodal Network tab state
  const [nodalNetworkTab, setNodalNetworkTab] = useState<'topology' | 'team'>('topology');

  // Nodal Network Topology nodes mapping
  const [nodalTopologyNodes, setNodalTopologyNodes] = useState([
    { id: 'SRC1', label: 'SRC A', x: 120, y: 70, r: 22, fill: '#0F5132', details: 'Victim Ledger A (Pranav Roy). UPI transfer flagged as fraudulent.', channel: 'UPI IN', volume: 245000, status: 'VICTIM REPORTED' },
    { id: 'SRC2', label: 'SRC B', x: 120, y: 230, r: 22, fill: '#0F5132', details: 'Victim Ledger B (Anita Sen). IMPS phishing victim credit.', channel: 'IMPS IN', volume: 185000, status: 'VICTIM REPORTED' },
    { id: 'MULE', label: 'MULE', x: 340, y: 150, r: 30, fill: '#DC2626', details: 'Suspicious Hub (live account from triage queue). Recipient of multi-source structured credits.', channel: 'Core Hub', volume: 430000, status: 'MULE SUSPECT' },
    { id: 'HOP1', label: 'HOP 1', x: 560, y: 70, r: 20, fill: '#DC2626', details: 'First-tier pass-through account (Gopal Das). Rapid exit pipeline.', channel: 'IMPS OUT', volume: 250000, status: 'HIGH VELOCITY' },
    { id: 'HOP2', label: 'HOP 2', x: 560, y: 230, r: 20, fill: '#DC2626', details: 'First-tier pass-through account (Lata Devi). High frequency split.', channel: 'UPI OUT', volume: 180000, status: 'HIGH VELOCITY' },
    { id: 'EXIT1', label: 'EXIT 1', x: 740, y: 50, r: 18, fill: '#64748B', details: 'Cryptocurrency Exchange Wallet (WazirX). Final cash out.', channel: 'RTGS', volume: 150000, status: 'FINAL OUTFLOW' },
    { id: 'EXIT2', label: 'EXIT 2', x: 740, y: 120, r: 18, fill: '#64748B', details: 'ATM Cash withdrawal point (NCR ATM Kolkata).', channel: 'CASH OUT', volume: 100000, status: 'FINAL OUTFLOW' },
    { id: 'EXIT3', label: 'EXIT 3', x: 740, y: 230, r: 18, fill: '#64748B', details: 'Overseas Trade Invoicing shell (Hong Kong Ltd).', channel: 'RTGS', volume: 180000, status: 'FINAL OUTFLOW' }
  ]);

  const [nodalDraggedNodeId, setNodalDraggedNodeId] = useState<string | null>(null);
  const nodalSvgRef = useRef<SVGSVGElement>(null);
  const [selectedNodalNode, setSelectedNodalNode] = useState<any>(null);
  const [isNodalFS, setIsNodalFS] = useState(false);

  // Phase 9 Case Inquiry Wizard Modal States
  const [isInquiryOpen, setIsInquiryOpen] = useState(false);
  const [inquiryStep, setInquiryStep] = useState(1);
  const [inquiryType, setInquiryType] = useState('Asset freeze');
  const [inquiryNotes, setInquiryNotes] = useState('');

  const handleNodalNodeClick = (node: any) => {
    setSelectedNodalNode(node);
  };

  const handleNodalMouseDown = (nodeId: string) => {
    setNodalDraggedNodeId(nodeId);
  };

  const handleNodalMouseMove = (e: React.MouseEvent) => {
    if (!nodalDraggedNodeId || !nodalSvgRef.current) return;
    const rect = nodalSvgRef.current.getBoundingClientRect();
    const viewBoxWidth = 800;
    const viewBoxHeight = 320;
    const x = (e.clientX - rect.left) * (viewBoxWidth / rect.width);
    const y = (e.clientY - rect.top) * (viewBoxHeight / rect.height);
    
    const constrainedX = Math.max(30, Math.min(viewBoxWidth - 30, x));
    const constrainedY = Math.max(30, Math.min(viewBoxHeight - 30, y));

    setNodalTopologyNodes((prev) =>
      prev.map((node) => {
        if (node.id === nodalDraggedNodeId) {
          return { ...node, x: constrainedX, y: constrainedY };
        }
        return node;
      })
    );
  };

  const handleNodalMouseUp = () => {
    setNodalDraggedNodeId(null);
  };

  // Compliance checklist states for deep-dive
  const [chkKYC, setChkKYC] = useState(false);
  const [chkBehavior, setChkBehavior] = useState(false);
  const [chkNetwork, setChkNetwork] = useState(false);

  const playbookComplete = useMemo(() => {
    return chkKYC && chkBehavior && chkNetwork;
  }, [chkKYC, chkBehavior, chkNetwork]);

  // Topology node selection
  const handleNodeClick = (node: any) => {
    setSelectedTopologyNode(node);
  };

  // Dragging event triggers inside SVG
  const handleMouseDown = (nodeId: string) => {
    setDraggedNodeId(nodeId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggedNodeId || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const viewBoxWidth = 520;
    const viewBoxHeight = 380;
    const x = (e.clientX - rect.left) * (viewBoxWidth / rect.width);
    const y = (e.clientY - rect.top) * (viewBoxHeight / rect.height);

    const constrainedX = Math.max(30, Math.min(viewBoxWidth - 30, x));
    const constrainedY = Math.max(30, Math.min(viewBoxHeight - 30, y));

    setTopologyNodes((prev) =>
      prev.map((node) => {
        if (node.id === draggedNodeId) {
          return { ...node, x: constrainedX, y: constrainedY };
        }
        return node;
      })
    );
  };

  const handleMouseUp = () => {
    setDraggedNodeId(null);
  };

  // Alert Detail matching
  const alertItem = useMemo(() => {
    return alerts.find(a => a.accountId === selectedAlertId) || alerts[0];
  }, [alerts, selectedAlertId]);

  const isBlocked = useMemo(() => {
    return alertItem ? blockedAccounts.includes(alertItem.accountId) : false;
  }, [blockedAccounts, alertItem]);

  // Recommended enforcement status mapping
  const enforcementStatus = useMemo(() => {
    if (!alertItem) return null;
    if (isBlocked) {
      return {
        label: "CRITICAL FREEZE CREDIT ENFORCED",
        desc: "Credit logs frozen. Government STR Draft generated. Nodal Officer active.",
        color: "bg-red-50 border-red-200 text-[#DC2626] font-bold"
      };
    }
    if (alertItem.riskBand === 'Hard Hit') {
      return {
        label: "CRITICAL FREEZE CREDIT REQUIRED",
        desc: "Instant block incoming/outgoing funds. Govt 14C intel hit. Draft STR required.",
        color: "bg-red-50 border-red-200 text-[#DC2626] font-bold animate-pulse"
      };
    }
    if (alertItem.score >= 0.70) {
      return {
        label: "HOLD OUTGOING LEG & REVIEW",
        desc: "Freeze active outgoing transactions. Route to Level-2 Analyst. (15 min SLA)",
        color: "bg-amber-50 border-amber-200 text-amber-700 font-bold"
      };
    }
    return {
      label: "PASSIVE SHADOW MONITORING",
      desc: "Standard tracking limits remain active. Regular behavioral re-calibrations.",
      color: "bg-emerald-50 border-emerald-200 text-[#0F5132] font-bold"
    };
  }, [isBlocked, alertItem]);

  // Handle Mark as FP
  const handleMarkFP = () => {
    if (!playbookComplete) {
      showToast("Please audit all compliance playbook checkpoints before recording override.", "warning");
      return;
    }
    const accId = alertItem.accountId;
    showToast("Appended to feedback queue line log. Global counters re-calibrating...", "success");
    markAsFalsePositive(accId);
    
    // Reset playbook checks
    setChkKYC(false);
    setChkBehavior(false);
    setChkNetwork(false);
    
    // Switch to queue
    setCurrentView('alerts');
  };

  // Handle Execute Freeze
  const handleExecuteFreeze = () => {
    if (!playbookComplete) {
      showToast("Please audit all compliance playbook checkpoints before executing enforcement.", "warning");
      return;
    }
    if (isBlocked) return;
    executeSystemBlock(alertItem.accountId);
    showToast(`Instant credit freeze initialized. Draft STR drafted. Nodal Officer notified for account: ${alertItem.accountId}`, "warning");
  };

  // Alert list filtering state
  const [activeTab, setActiveTab] = useState<'All' | 'High' | 'Medium' | 'HardHit'>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredAlertsList = useMemo(() => {
    return alerts.filter((alert) => {
      if (activeTab === 'High' && alert.score < 0.70) return false;
      if (activeTab === 'Medium' && (alert.score < 0.30 || alert.score >= 0.70)) return false;
      if (activeTab === 'HardHit' && alert.riskBand !== 'Hard Hit') return false;

      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        return (
          alert.accountId.toLowerCase().includes(query) ||
          alert.customerName.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [alerts, activeTab, searchQuery]);

  return (
    <div className="space-y-6 select-none relative pb-10">
      
      {/* Floating Success Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-2xl shadow-xl flex items-center gap-3 border animate-bounce ${
          toast.type === 'success' ? 'bg-[#14532D] text-white border-[#419E73]/30' : 'bg-red-800 text-white border-red-500/30'
        }`}>
          <div className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center">
            {toast.type === 'success' ? <Check className="h-4 w-4 text-emerald-300" /> : <Lock className="h-4 w-4 text-red-300" />}
          </div>
          <div className="text-xs font-semibold max-w-sm font-sans leading-tight">
            {toast.message}
          </div>
          <button onClick={hideToast} className="text-white/60 hover:text-white shrink-0 ml-1.5">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ==========================================
          VIEW 1: EXECUTIVE DASHBOARD
          ========================================== */}
      {currentView === 'dashboard' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header titles */}
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-800 font-sans">Operational Account Risk Overview</h2>
            <p className="text-xs text-slate-400 mt-1.5 font-medium">Real-time anti-money laundering monitoring, calibrated machine signals, and quick SLA warning triggers.</p>
          </div>

          {/* Row A: KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* Card 1: Total Monitored Accounts */}
            <div className="bg-[#0F5132] min-h-[160px] shrink-0 flex flex-col justify-between rounded-3xl p-6 text-white relative overflow-hidden shadow-xl shadow-emerald-950/10 group select-none">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#14532D] to-[#419E73] opacity-90" />
              <button 
                onClick={() => setIsBaselineOpen(true)}
                className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-10"
              >
                <ArrowUpRight className="h-4 w-4 text-white" />
              </button>
              
              <div className="relative z-10 flex flex-col justify-between flex-1">
                <div className="text-[10px] font-bold text-emerald-100 uppercase tracking-widest">Total Monitored Accounts</div>
                <div className="text-3xl font-black font-mono tracking-tight my-auto py-2">
                  {totalProcessedCount.toLocaleString()}
                </div>
                <div className="text-[10px] text-emerald-100/90 font-medium font-sans mt-auto">Baseline pool verified</div>
              </div>
            </div>

            {/* Card 2: Confirmed Mule Network Pins */}
            <div className="bg-white border border-slate-200/80 min-h-[160px] shrink-0 flex flex-col justify-between rounded-3xl p-6 relative overflow-hidden shadow-[0_4px_20px_-2px_rgba(0,0,0,0.02)] group select-none">
              <button 
                onClick={() => setIsCaptureStatsOpen(true)}
                className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200/60 flex items-center justify-center transition-colors z-10"
              >
                <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-[#0F5132] transition-colors" />
              </button>

              <div className="relative z-10 flex flex-col justify-between flex-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confirmed Mule Network Pins</div>
                <div className="text-3xl font-black text-slate-800 font-mono tracking-tight my-auto py-2">
                  {trueMulesCount}
                </div>
                <div className="text-[10px] text-[#419E73] font-bold font-sans flex items-center gap-1 mt-auto">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#419E73] animate-pulse" />
                  0.89% base prevalence rate caught
                </div>
              </div>
            </div>

            {/* Card 3: Active Live Triage Alerts */}
            <div 
              onClick={() => setCurrentView('alerts')}
              className="bg-white border border-slate-200/80 hover:border-slate-350 min-h-[160px] shrink-0 flex flex-col justify-between rounded-3xl p-6 relative overflow-hidden shadow-[0_4px_20px_-2px_rgba(0,0,0,0.02)] group cursor-pointer transition-all hover:scale-[1.01] select-none"
            >
              <span className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-50 border border-slate-200/60 flex items-center justify-center z-10">
                <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-[#0F5132]" />
              </span>

              <div className="relative z-10 flex flex-col justify-between flex-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Live Triage Alerts</div>
                <div className="text-3xl font-black text-slate-800 font-mono tracking-tight my-auto py-2 flex items-baseline gap-2">
                  <span>{alerts.length}</span>
                  {alerts.length > 0 && (
                    <span className="text-[9px] bg-red-50 text-[#DC2626] border border-red-150 font-bold px-1.5 py-0.5 rounded uppercase font-mono shadow-sm shrink-0">
                      Queue
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 font-sans mt-auto">Assigned within 15-min SLA</div>
              </div>
            </div>

            {/* Card 4: Government 14C Hard Hits */}
            <div className="bg-white border border-slate-200/80 min-h-[160px] shrink-0 flex flex-col justify-between rounded-3xl p-6 relative overflow-hidden shadow-[0_4px_20px_-2px_rgba(0,0,0,0.02)] group select-none">
              <button 
                onClick={() => setIsCfcOpen(true)}
                className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200/60 flex items-center justify-center transition-colors z-10"
              >
                <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-[#0F5132] transition-colors" />
              </button>

              <div className="relative z-10 flex flex-col justify-between flex-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Government 14C Hard Hits</div>
                <div className="text-3xl font-black text-[#DC2626] font-mono tracking-tight my-auto py-2">
                  2
                </div>
                <div className="text-[10px] text-[#DC2626] font-bold font-sans mt-auto">Immediate freeze ordered</div>
              </div>
            </div>

          </div>

          {/* Row B: Graph & SLA Split */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Graph (2/3 width) - Replicating Donezo Project Analytics */}
            <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.02)]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 font-sans">Cross-Channel Transaction Density</h3>
                  <p className="text-[10px] text-slate-400 font-sans mt-0.5">Vertical mapping of daily volume. Sage pills show active monitoring spikes.</p>
                </div>
                
                <div className="flex items-center gap-1.5 bg-slate-50 text-[#0F5132] px-2.5 py-1 rounded-full border border-slate-200/60 font-mono font-bold text-[9px] shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#419E73] animate-ping" />
                  <span>{eventsPerSecond} REC/S</span>
                </div>
              </div>

              {/* vertical bar chart - Replicating Donezo image styling */}
              <div className="h-44 flex items-end justify-between px-4 pb-2 relative">
                {/* Daily volume columns */}
                {[
                  { day: 'S', h: 'h-24', fill: 'hatched-pattern border-2 border-slate-250 border-dashed rounded-full' },
                  { day: 'M', h: 'h-36', fill: 'bg-[#0F5132] rounded-full' },
                  { day: 'T', h: 'h-28', fill: 'bg-[#419E73] rounded-full relative', badge: '74%' },
                  { day: 'W', h: 'h-40', fill: 'bg-[#0F5132] rounded-full' },
                  { day: 'T', h: 'h-20', fill: 'hatched-pattern border border-slate-300 border-dashed rounded-full' },
                  { day: 'F', h: 'h-32', fill: 'hatched-pattern border border-slate-300 border-dashed rounded-full' },
                  { day: 'S', h: 'h-16', fill: 'hatched-pattern border border-slate-300 border-dashed rounded-full' }
                ].map((item, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-3 w-10 relative group">
                    {item.badge && (
                      <span className="absolute -top-7 bg-emerald-50 text-[#0F5132] border border-emerald-200 text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-sm font-mono z-10 shrink-0">
                        {item.badge}
                      </span>
                    )}
                    <div className="w-6 h-40 flex items-end justify-center bg-slate-50/50 rounded-full">
                      <div className={`w-full ${item.h} ${item.fill} transition-all duration-500 hover:scale-x-105 shadow-sm`} />
                    </div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{item.day}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Warning card (1/3 width) - Replicating Donezo Reminders */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800 font-sans">Critical SLA Warnings</h3>
                  <span className="text-[9px] bg-red-50 text-[#DC2626] font-bold px-2 py-0.5 rounded-full border border-red-150">URGENT</span>
                </div>

                <div className="mt-4 space-y-3.5">
                  <div className="border-l-3 border-[#DC2626] bg-red-50/30 p-3.5 rounded-2xl border border-red-100/50">
                    <h4 className="text-xs font-bold text-slate-800 font-sans">Mule Ring Extraction Alert</h4>
                    <p className="text-[10px] text-slate-500 font-sans mt-1 leading-relaxed">
                      Cluster MULE_RING_3024: 6 pass-through nodes transferring ₹49,990 structured payments within 3 minutes.
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-sans px-1">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span>Triggered: <span className="font-semibold text-slate-700">02:00 pm - 04:00 pm</span></span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  if (highestRiskAlert) {
                    setSelectedAlertId(highestRiskAlert.accountId);
                    setCurrentView('triage');
                  } else {
                    showToast("No active alerts present in queue.", "warning");
                  }
                }}
                className="w-full mt-6 py-3.5 bg-[#0F5132] hover:bg-[#14532D] text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] shadow-md shadow-emerald-950/15"
              >
                <ShieldCheck className="h-4 w-4" />
                Triage Selected Account
              </button>
            </div>

          </div>

          {/* Row C: Triple-Split Grid Bottom Row & Recent Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Bottom Left Card: Analyst Feed - Replicating Donezo Team Collaboration */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.02)]">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold text-slate-800 font-sans">Live Real-Time Analyst Feed</h3>
                <button 
                  onClick={() => setIsAddNodalOpen(true)}
                  className="text-[10px] font-bold text-[#0F5132] hover:text-[#14532D] border border-slate-200/80 px-3 py-1 rounded-full bg-slate-50 shadow-sm animate-pulse"
                >
                  + Add Nodal
                </button>
              </div>

              {/* Investigator list */}
              <div className="space-y-4">
                {analysts.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[#0F5132] border border-slate-200 font-mono">
                        {item.name[0]}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">{item.name}</div>
                        <div className="text-[9px] font-mono text-slate-400 mt-0.5">Auditing: {item.task}</div>
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${item.color}`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Center Card: Gauge Distribution - Replicating Donezo Project Progress */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.02)] flex flex-col justify-between items-center">
              <div className="w-full text-left">
                <h3 className="text-sm font-bold text-slate-800 font-sans">System Recall Distribution</h3>
                <p className="text-[10px] text-slate-400 font-sans mt-0.5">True positive localization of high-precision alert bands.</p>
              </div>

              {/* Massive semicircular gauge */}
              <div className="relative mt-2 flex flex-col items-center justify-center w-full">
                <svg className="w-44 h-24 overflow-visible" viewBox="0 0 100 50">
                  {/* Hatched Background/Pending segment */}
                  <path 
                    d="M 10 50 A 40 40 0 0 1 90 50" 
                    fill="none" 
                    stroke="#E2E8F0" 
                    strokeWidth="10" 
                    strokeLinecap="round" 
                  />
                  {/* Donezo Style Hatch lines inside background arc via pattern overlay */}
                  <path 
                    d="M 10 50 A 40 40 0 0 1 90 50" 
                    fill="none" 
                    stroke="#CBD5E1" 
                    strokeWidth="10" 
                    strokeLinecap="round" 
                    strokeDasharray="2,3"
                    className="opacity-70"
                  />
                  {/* Completed / High-precision Green active segment */}
                  <path 
                    d="M 10 50 A 40 40 0 0 1 70 23" 
                    fill="none" 
                    stroke="#0F5132" 
                    strokeWidth="10" 
                    strokeLinecap="round" 
                    className="transition-all duration-1000"
                  />
                  {/* In Progress segment */}
                  <path 
                    d="M 70 23 A 40 40 0 0 1 83 36" 
                    fill="none" 
                    stroke="#419E73" 
                    strokeWidth="10" 
                    strokeLinecap="round" 
                  />
                </svg>

                {/* Typography centered inside semicircular arc */}
                <div className="absolute top-12 flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-extrabold text-slate-800 font-mono tracking-tighter">75%</span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-sans">Mules Captured</span>
                </div>
              </div>

              {/* Legend with color mapping indicators */}
              <div className="w-full flex items-center justify-between border-t border-slate-100 pt-4 text-[9px] text-slate-400 font-bold font-sans">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#0F5132]" />
                  <span>High Risk (75%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#419E73]" />
                  <span>Med Risk (15%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-200 border border-slate-350 border-dashed" />
                  <span>Low Risk (10%)</span>
                </div>
              </div>
            </div>

            {/* Bottom Right Card: Ingestion Clock - Replicating Donezo Time Tracker */}
            <div className="rounded-3xl bg-[#082E1E] text-white p-6 relative overflow-hidden shadow-xl shadow-emerald-950/20 flex flex-col justify-between select-none group">
              {/* Rich dark textured wave background */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#0F5132]/50 to-[#051F13]" />
              <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-[#419E73]/15 blur-2xl group-hover:scale-110 transition-transform" />
              
              <div className="relative z-10 w-full">
                <div className="flex items-center justify-between pb-3 border-b border-white/10 text-[10px] font-bold text-emerald-100 uppercase tracking-widest">
                  <span>Real-Time Streaming Loop Ticker</span>
                  <span className="font-mono text-emerald-300">Active</span>
                </div>
                
                <p className="text-[10px] text-white/60 font-sans mt-3">p95 Latency: &lt;100ms</p>
              </div>

              {/* Running clock in massive Monospace */}
              <div className="relative z-10 my-4 text-center">
                <div className="text-3.5xl font-bold font-mono tracking-widest text-emerald-300 drop-shadow-sm select-all">
                  {tickerTime}
                </div>
                <div className="text-[8px] font-mono tracking-widest text-[#419E73] font-bold uppercase mt-1">Ingesting live ledger pulses</div>
              </div>

              {/* Media Controls */}
              <div className="relative z-10 flex items-center justify-center gap-3">
                <button 
                  onClick={() => {
                    setTickerActive(!tickerActive);
                    showToast(tickerActive ? "Streaming ingestion loop PAUSED." : "Streaming ingestion loop ACTIVE.", "success");
                  }}
                  className="h-10 w-10 bg-white/10 hover:bg-white/15 border border-white/15 rounded-full flex items-center justify-center text-white transition-all shadow-sm hover:scale-105 active:scale-95"
                  title={tickerActive ? "Pause stream feed" : "Play stream feed"}
                >
                  {tickerActive ? <Pause className="h-4 w-4 fill-white" /> : <Play className="h-4 w-4 fill-white ml-0.5" />}
                </button>
                
                <button 
                  onClick={() => {
                    showToast("Refreshed active streaming batch ledger logs.", "success");
                  }}
                  className="h-10 w-10 bg-white/10 hover:bg-white/15 border border-white/15 rounded-full flex items-center justify-center text-white transition-all shadow-sm hover:scale-105 active:scale-95"
                  title="Force refresh batch loop"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
              </div>
            </div>

          </div>

          {/* Right Context Side-Rail Panel (Project List Clone) - Details vertical logs */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 font-sans">Recent Action Logs / STR Filings</h3>
                <p className="text-[10px] text-slate-400 font-sans mt-0.5">Disposition statuses filed for ledger transactions.</p>
              </div>
              
              <button 
                onClick={() => setCurrentView('alerts')}
                className="text-[10px] font-bold text-[#0F5132] hover:underline"
              >
                + View Queue
              </button>
            </div>

            {/* List entries */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {recentLogs.map((item, idx) => (
                <div key={idx} className="border border-slate-200/60 p-4 rounded-2xl flex flex-col justify-between gap-3 shadow-[0_2px_8px_-1px_rgba(0,0,0,0.01)] bg-slate-50/20 hover:border-slate-350 transition-all select-none">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-[#0F5132] shadow-sm uppercase shrink-0">
                      {item.channel}
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">{item.time}</span>
                  </div>

                  <div>
                    <div className="font-mono text-xs text-slate-700 font-bold tracking-wide truncate">{item.id}</div>
                    <div className={`text-[9.5px] font-semibold font-sans mt-2 px-2 py-1 rounded-xl text-center border truncate ${item.color}`}>
                      {item.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ==========================================
          ACTIVE ANALYST TRIAGE QUEUE (TABLE VIEW)
          ========================================== */}
      {currentView === 'alerts' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header titles */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-800 font-sans">Active Analyst Triage Queue</h2>
              <p className="text-xs text-slate-400 mt-1.5 font-medium">High-velocity risk table for sorting, auditing, and executing money laundering checks.</p>
            </div>
            
            <div className="flex items-center gap-2 text-xs bg-white border border-slate-200/80 px-3.5 py-1.5 rounded-full font-mono text-slate-450 shadow-sm font-semibold">
              <span>Active Queue:</span>
              <span className="text-[#0F5132] font-extrabold">{alerts.length} accounts</span>
            </div>
          </div>

          {/* Filtering control bar */}
          <div className="bg-white border border-slate-200/80 p-4 rounded-3xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.02)] flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Donezo tabs styled controls */}
            <div className="flex bg-slate-100/60 p-0.5 rounded-2xl border border-slate-200/60 w-full md:w-auto overflow-x-auto shrink-0 font-mono text-[11px]">
              <button
                onClick={() => setActiveTab('All')}
                className={`px-4 py-2 rounded-xl transition-all shrink-0 ${
                  activeTab === 'All'
                    ? 'bg-white text-[#0F5132] font-bold border border-slate-200 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}
              >
                All Alerts ({alerts.length})
              </button>
              
              <button
                onClick={() => setActiveTab('High')}
                className={`px-4 py-2 rounded-xl transition-all shrink-0 ${
                  activeTab === 'High'
                    ? 'bg-red-50 text-[#DC2626] border border-red-100 font-bold shadow-sm'
                    : 'text-slate-500 hover:text-red-500 hover:bg-red-50/20 border border-transparent'
                }`}
              >
                High Risk (&ge; 0.70)
              </button>
              
              <button
                onClick={() => setActiveTab('Medium')}
                className={`px-4 py-2 rounded-xl transition-all shrink-0 ${
                  activeTab === 'Medium'
                    ? 'bg-amber-50 text-amber-600 border border-amber-100 font-bold shadow-sm'
                    : 'text-slate-500 hover:text-amber-600 hover:bg-amber-50/20 border border-transparent'
                }`}
              >
                Medium (0.30-0.70)
              </button>
              
              <button
                onClick={() => setActiveTab('HardHit')}
                className={`px-4 py-2 rounded-xl transition-all shrink-0 ${
                  activeTab === 'HardHit'
                    ? 'bg-purple-50 text-purple-600 border border-purple-100 font-bold shadow-sm'
                    : 'text-slate-500 hover:text-purple-600 hover:bg-purple-50/20 border border-transparent'
                }`}
              >
                Gov 14C Blocks
              </button>
            </div>

            {/* Search filter input */}
            <div className="relative w-full md:max-w-xs">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </span>
              <input
                type="text"
                placeholder="Search hash or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 hover:border-slate-350 focus:border-[#0F5132] focus:outline-none rounded-full pl-10 pr-4 py-2.5 text-xs text-slate-800 font-mono placeholder:font-sans placeholder:text-slate-400 transition-colors shadow-sm"
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white border border-slate-200/80 rounded-3xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.02)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-[9px] font-mono tracking-widest text-slate-400 uppercase font-extrabold">
                    <th className="py-4 px-6 font-bold">Account ID</th>
                    <th className="py-4 px-6 font-bold">Customer Name</th>
                    <th className="py-4 px-6 font-bold">Calibrated Score</th>
                    <th className="py-4 px-6 font-bold">Violated Rules</th>
                    <th className="py-4 px-6 font-bold">Ingestion UTC</th>
                    <th className="py-4 px-6 font-bold">SLA Countdown</th>
                    <th className="py-4 px-6 font-bold text-right">Triage Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredAlertsList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-xs font-mono text-slate-400 bg-white">
                        No active regulatory alarms matched the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredAlertsList.map((alert) => {
                      const isAccountBlocked = blockedAccounts.includes(alert.accountId);
                      return (
                        <tr 
                          key={alert.accountId}
                          onClick={() => {
                            setSelectedAlertId(alert.accountId);
                            setCurrentView('triage');
                          }}
                          className="hover:bg-slate-50/60 cursor-pointer transition-colors group"
                        >
                          {/* Account ID */}
                          <td className="py-4.5 px-6">
                            <div className="flex items-center gap-2">
                              <CopyableAccountId accountId={alert.accountId} />
                              {isAccountBlocked && (
                                <span className="text-[8px] bg-red-50 text-[#DC2626] border border-red-150 font-black px-1.5 py-0.5 rounded font-mono uppercase shadow-sm">
                                  Frozen
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Customer Name */}
                          <td className="py-4.5 px-6 text-xs text-slate-800 font-bold font-mono tracking-wide">
                            {alert.customerName}
                          </td>

                          {/* Calibrated score */}
                          <td className="py-4.5 px-6">
                            <div className="flex items-center gap-2 font-mono text-xs">
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                alert.riskBand === 'Hard Hit' ? 'bg-purple-500 shadow-sm shadow-purple-500/50' :
                                alert.score >= 0.70 ? 'bg-[#DC2626] shadow-sm shadow-red-500/50 animate-pulse' :
                                alert.score >= 0.30 ? 'bg-amber-500 shadow-sm shadow-amber-500/50' :
                                'bg-[#419E73] shadow-sm shadow-emerald-500/50'
                              }`} />
                              
                              <span className="font-extrabold text-slate-800">
                                {(alert.score * 100).toFixed(1)}%
                              </span>
                              
                              <span className="text-[9px] text-slate-400 font-bold tracking-wider uppercase pl-1">
                                {alert.riskBand === 'Hard Hit' ? 'BLOCK' :
                                 alert.score >= 0.70 ? 'HIGH' :
                                 alert.score >= 0.30 ? 'MED' : 'LOW'}
                              </span>
                            </div>
                          </td>

                          {/* Rules */}
                          <td className="py-4.5 px-6 max-w-xs">
                            <div className="flex flex-wrap gap-1">
                              {alert.matchedRules.map((rule, idx) => (
                                <span 
                                  key={idx} 
                                  className="text-[8px] font-mono bg-slate-50 text-slate-500 px-2 py-0.5 rounded-md border border-slate-200/80 shadow-sm font-semibold"
                                >
                                  {rule}
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* Ingestion */}
                          <td className="py-4.5 px-6 font-mono text-xs text-slate-400">
                            {alert.timestamp.substring(11, 19)}
                          </td>

                          {/* SLA Timer */}
                          <td className="py-4.5 px-6">
                            <SlaTimer timestamp={alert.timestamp} />
                          </td>

                          {/* Inspect action */}
                          <td className="py-4.5 px-6 text-right">
                            <div className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 group-hover:text-[#0F5132] font-bold transition-colors">
                              <span className="opacity-0 group-hover:opacity-100 transition-all mr-1">AUDIT</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </div>
                          </td>

                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ==========================================
          VIEW 2: DRILL-DOWN INVESTIGATIVE HUB (3-PANEL DETAIL VIEW)
          ========================================== */}
      {currentView === 'triage' && alertItem && (
        <div className="space-y-5 animate-fadeIn">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setCurrentView('alerts')}
                className="h-9 w-9 rounded-full bg-white hover:bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all shadow-sm"
                title="Return to active queue"
              >
                <ArrowRight className="h-4 w-4 rotate-180" />
              </button>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-bold tracking-tight text-slate-850 font-sans">Suspicious Account Audit Console</h2>
                  <span className="text-[10px] bg-red-50 text-[#DC2626] font-extrabold border border-red-150 px-2 py-0.5 rounded-full font-mono uppercase">
                    Level-2 Suspicious Audit
                  </span>
                </div>
                <p className="text-[10px] font-mono text-slate-400 mt-1 font-semibold">Triage reference: {alertItem.accountId}</p>
              </div>
            </div>

            {/* SLA badge indicator */}
            <div className="flex items-center gap-3 bg-white border border-slate-200/80 pl-3.5 pr-4 py-2 rounded-full shadow-sm text-xs font-semibold text-slate-500">
              <span className="text-[10px] font-bold uppercase tracking-wider">Review Limit:</span>
              <SlaTimer timestamp={alertItem.timestamp} />
            </div>
          </div>

          {/* Core 3-Panel Deep-Dive Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
            
            {/* PANEL 1: KYC PROFILE & INTERACTIVE TOPOLOGY GRAPH */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.02)] space-y-4">
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#0F5132] font-mono flex items-center gap-1.5">
                  <User className="h-4 w-4" /> KYC Details & Topology
                </h3>
                
                <button 
                  onClick={() => setIsFS(!isFS)} 
                  className="p-1.5 hover:bg-slate-50 rounded border border-slate-200/80 text-slate-400 hover:text-slate-700 transition-colors shadow-sm shrink-0"
                  title={isFS ? "Compress Topology" : "Expand Fullscreen"}
                >
                  {isFS ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* KYC Profile mapping details */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-2.5 font-sans text-xs">
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Account Name</span>
                    <div className="font-bold text-slate-700 mt-0.5 truncate">{alertItem.customerName}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">KYC Bio Status</span>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        alertItem.kycStatus === 'Verified' ? 'bg-[#419E73]' :
                        alertItem.kycStatus === 'Flagged' ? 'bg-[#DC2626] animate-pulse' : 'bg-amber-500'
                      }`} />
                      <span className="font-bold text-slate-700">{alertItem.kycStatus}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5 border-t border-slate-200/60 pt-2.5">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Risk Flag</span>
                    <div className="font-bold text-[#DC2626] mt-0.5 font-mono">{alertItem.riskBand}</div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Account Age</span>
                    <div className="font-semibold text-slate-700 mt-0.5">{(() => {
                      const opened = alertItem.features['Account opened'];
                      if (typeof opened !== 'string' || opened === '—') return '—';
                      const d = new Date(opened);
                      if (Number.isNaN(d.getTime())) return opened;
                      const years = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
                      return `${years.toFixed(1)} Years`;
                    })()}</div>
                  </div>
                </div>

                <div className="border-t border-slate-200/60 pt-2.5 space-y-1">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{String(alertItem.features['Region'] ?? '—')} region · {String(alertItem.features['Occupation'] ?? '—')} · {String(alertItem.features['Segment'] ?? '—')}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Smartphone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate text-[11px] font-mono">{String(alertItem.features['Account type'] ?? '—')} · {String(alertItem.features['Time window'] ?? '—')} aggregation window</span>
                  </div>
                </div>
                <p className="text-[9px] text-slate-400 leading-snug pt-1 italic">
                  Customer name, KYC, and counterparty ledger synthesized for visualization · dataset is anonymized.
                </p>
              </div>

              {/* Topology SVG Network Diagram - Draggable / Interactive */}
              <div className={`relative border border-slate-200/80 rounded-2xl bg-slate-50/50 p-2 overflow-hidden ${
                isFS ? 'fixed inset-4 z-50 bg-white border-2 p-6 shadow-2xl rounded-3xl flex flex-col justify-between' : 'h-80'
              }`}>
                {isFS && (
                  <div className="pb-3 border-b flex items-center justify-between mb-4 shrink-0">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-[#0F5132]" />
                      <h3 className="text-sm font-bold text-slate-800">Fullscreen suspects topology visualizer</h3>
                    </div>
                    <button 
                      onClick={() => setIsFS(false)}
                      className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-full border text-slate-500 hover:text-slate-800 transition-all shadow-sm"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2 font-mono flex items-center gap-1.5 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626] animate-pulse" /> Draggable Ledger Node Mapping
                </div>

                <div className="flex-1 w-full relative overflow-hidden" style={{ minHeight: isFS ? '450px' : '230px' }}>
                  <svg
                    ref={svgRef}
                    viewBox="0 0 520 380"
                    preserveAspectRatio="xMidYMid meet"
                    className="w-full h-full border border-slate-200/40 rounded-xl bg-white cursor-crosshair shadow-inner"
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  >
                    {/* Directional Connector Arrowheads definitions */}
                    <defs>
                      <marker id="arrow" viewBox="0 0 10 10" refX="15" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#CBD5E1" />
                      </marker>
                      <marker id="arrow-green" viewBox="0 0 10 10" refX="15" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#0F5132" />
                      </marker>
                      <marker id="arrow-red" viewBox="0 0 10 10" refX="15" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#DC2626" />
                      </marker>
                    </defs>

                    {/* Node connector lines */}
                    {topologyNodes.map((node) => {
                      if (node.id === 'MULE') return null;
                      const muleNode = topologyNodes[1];
                      const isOutbound = ['B1', 'B2', 'B3', 'B4'].includes(node.id);
                      
                      return (
                        <line
                          key={`line-${node.id}`}
                          x1={isOutbound ? muleNode.x : node.x}
                          y1={isOutbound ? muleNode.y : node.y}
                          x2={isOutbound ? node.x : muleNode.x}
                          y2={isOutbound ? node.y : muleNode.y}
                          stroke={isOutbound ? '#DC2626' : '#0F5132'}
                          strokeWidth="2.5"
                          strokeDasharray={node.id === 'B2' ? '5,5' : 'none'}
                          markerEnd={isOutbound ? 'url(#arrow-red)' : 'url(#arrow-green)'}
                        />
                      );
                    })}

                    {/* Nodes mapping */}
                    {topologyNodes.map((node) => {
                      const isSelected = selectedTopologyNode?.id === node.id;
                      return (
                        <g 
                          key={node.id} 
                          className="cursor-move group"
                          onMouseDown={() => {
                            handleMouseDown(node.id);
                            handleNodeClick(node);
                          }}
                        >
                          {/* Outer glowing halo ring on selection */}
                          {isSelected && (
                            <circle
                              cx={node.x}
                              cy={node.y}
                              r={node.r + 5}
                              fill="none"
                              stroke={node.id === 'MULE' ? '#DC2626' : '#0F5132'}
                              strokeWidth="2.5"
                              className="animate-pulse"
                            />
                          )}

                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={node.r}
                            fill={node.fill}
                            className="shadow-md transition-colors"
                          />

                          {/* Node label */}
                          <text
                            x={node.x}
                            y={node.y + 4}
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize="9"
                            fontWeight="bold"
                            className="pointer-events-none select-none font-mono"
                          >
                            {node.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Node details callout */}
                {selectedTopologyNode && (
                  <div className="absolute bottom-2 left-2 right-2 bg-slate-900/90 text-white rounded-xl p-3 shadow-md border border-slate-800 text-[10px] space-y-1.5 backdrop-blur-sm z-10 font-sans">
                    <div className="flex items-center justify-between border-b border-white/10 pb-1 shrink-0">
                      <span className="font-bold text-emerald-300 font-mono tracking-wide">{selectedTopologyNode.label} NODE INFO</span>
                      <span className="text-[9px] bg-white/15 px-1.5 py-0.2 rounded font-mono text-white/90">{selectedTopologyNode.channel}</span>
                    </div>
                    <p className="text-white/80 leading-normal">{selectedTopologyNode.details}</p>
                    <div className="flex items-center justify-between text-[9px] text-white/50 pt-1 shrink-0">
                      <span>Value Routed: <span className="font-bold font-mono text-emerald-300">₹{selectedTopologyNode.volume.toLocaleString()}</span></span>
                      <span className="uppercase text-red-300 font-bold font-mono">{selectedTopologyNode.status}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* PANEL 2: MODEL TRANSPARENCY & SHAP METRIC EXPLAINER */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.02)] space-y-4">
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#0F5132] font-mono flex items-center gap-1.5">
                  <BrainCircuit className="h-4.5 w-4.5" /> Model Transparency Layer
                </h3>
              </div>

              {/* High contrast SVG calibrated risk meter */}
              <div className="bg-slate-50/50 border border-slate-200/80 p-4 rounded-2xl flex flex-col items-center justify-center relative">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3 text-center w-full">Calibrated Probability Meter</div>
                
                <svg className="w-40 h-20 overflow-visible" viewBox="0 0 100 50">
                  {/* Gauge backdrop arcs */}
                  <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#E2E8F0" strokeWidth="8" strokeLinecap="round" />
                  <path d="M 10 50 A 40 40 0 0 1 40 15" fill="none" stroke="#419E73" strokeWidth="8" />
                  <path d="M 40 15 A 40 40 0 0 1 70 23" fill="none" stroke="#F59E0B" strokeWidth="8" />
                  <path d="M 70 23 A 40 40 0 0 1 90 50" fill="none" stroke="#DC2626" strokeWidth="8" strokeLinecap="round" />
                  
                  {/* Indicator needle angle based on score */}
                  {alertItem && (
                    <g transform={`rotate(${(alertItem.score * 180) - 90}, 50, 50)`}>
                      <line x1="50" y1="50" x2="50" y2="16" stroke="#0F5132" strokeWidth="2.5" strokeLinecap="round" />
                      <circle cx="50" cy="50" r="4.5" fill="#0F5132" />
                    </g>
                  )}
                </svg>

                <div className="mt-3 text-center">
                  <span className="text-2.5xl font-black text-slate-800 font-mono tracking-tighter">{(alertItem.score * 100).toFixed(1)}%</span>
                  <div className="text-[9px] text-[#DC2626] font-bold uppercase font-mono mt-0.5 tracking-wide flex items-center gap-1 justify-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626] animate-pulse" />
                    ISOTONIC_PROBABILITY_BOUND
                  </div>
                </div>
              </div>

              {/* Inline SHAP feature attribution bar layout */}
              <div className="space-y-3.5">
                <div className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest font-mono border-b border-slate-100 pb-1.5">
                  SHAP Explainability Vectors
                </div>

                <div className="space-y-3 font-sans text-xs">
                  {alertItem.shapExplanations.map((exp, idx) => {
                    const isPositive = exp.contribution > 0;
                    const pct = Math.abs(exp.contribution) * 100;
                    return (
                      <div key={idx} className="space-y-1 group relative">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="text-[9px] bg-slate-100 border border-slate-200 px-1.5 rounded font-black text-slate-500 shadow-sm shrink-0">
                              {exp.feature}
                            </span>
                            <span className="text-[10.5px] text-slate-600 truncate max-w-[170px]">{exp.humanDescription}</span>
                          </div>
                          
                          <span className={`font-bold font-mono shrink-0 ml-1.5 ${isPositive ? 'text-[#DC2626]' : 'text-indigo-650'}`}>
                            {isPositive ? '+' : '-'}{pct.toFixed(0)}%
                          </span>
                        </div>

                        {/* Bar graphics */}
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                          {isPositive ? (
                            <div className="h-full bg-[#DC2626]" style={{ width: `${pct}%`, marginLeft: '0px' }} />
                          ) : (
                            <div className="h-full bg-indigo-600" style={{ width: `${pct}%`, marginLeft: '0px' }} />
                          )}
                        </div>

                        {/* Custom hover explanation tooltip */}
                        <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute bottom-full left-0 right-0 bg-slate-900 text-white text-[10px] p-2.5 rounded-xl shadow-lg border border-slate-800 transition-opacity duration-200 z-10 font-sans leading-normal mb-1.5">
                          {exp.humanDescription}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* PANEL 3: COMPLIANCE EXECUTION HUB & PLAYBOOKS */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.02)] space-y-4">
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#0F5132] font-mono flex items-center gap-1.5">
                  <FileCheck2 className="h-4.5 w-4.5" /> Compliance Execution Hub
                </h3>
              </div>

              {/* enforcement policy status callout */}
              <div className={`p-4 rounded-2xl border text-xs leading-relaxed ${enforcementStatus?.color}`}>
                <h4 className="font-extrabold uppercase font-sans tracking-wide">{enforcementStatus?.label}</h4>
                <p className="mt-1.5 font-normal font-sans opacity-95">{enforcementStatus?.desc}</p>
              </div>

              {/* Interactive Playbook checklist checkpoints */}
              <div className="space-y-3 pt-2">
                <div className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest font-mono border-b border-slate-100 pb-1.5">
                  RBI FREE-AI Triage Checklist
                </div>

                <div className="space-y-2.5 font-sans text-xs">
                  
                  <label className="flex items-start gap-3 p-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-200/60 rounded-xl cursor-pointer select-none transition-colors">
                    <input 
                      type="checkbox" 
                      checked={chkKYC}
                      onChange={(e) => setChkKYC(e.target.checked)}
                      className="mt-0.5 h-4 w-4 text-[#0F5132] focus:ring-[#419E73] rounded border-slate-300"
                    />
                    <div>
                      <span className="font-bold text-slate-700 font-sans">Verify KYC Geographic IP logs</span>
                      <p className="text-[9.5px] text-slate-400 font-sans mt-0.5">Audit device tower locations against home branch billing.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-200/60 rounded-xl cursor-pointer select-none transition-colors">
                    <input 
                      type="checkbox" 
                      checked={chkBehavior}
                      onChange={(e) => setChkBehavior(e.target.checked)}
                      className="mt-0.5 h-4 w-4 text-[#0F5132] focus:ring-[#419E73] rounded border-slate-300"
                    />
                    <div>
                      <span className="font-bold text-slate-700 font-sans">Audit Pass-through split signals</span>
                      <p className="text-[9.5px] text-slate-400 font-sans mt-0.5">Verify speed of incoming credit routed out to beneficiary nodes.</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-200/60 rounded-xl cursor-pointer select-none transition-colors">
                    <input 
                      type="checkbox" 
                      checked={chkNetwork}
                      onChange={(e) => setChkNetwork(e.target.checked)}
                      className="mt-0.5 h-4 w-4 text-[#0F5132] focus:ring-[#419E73] rounded border-slate-300"
                    />
                    <div>
                      <span className="font-bold text-slate-700 font-sans">Cross-match Govt 14C portal records</span>
                      <p className="text-[9.5px] text-slate-400 font-sans mt-0.5">Check central database lists for matches on victim hashes.</p>
                    </div>
                  </label>

                </div>
              </div>

              {/* Action trigger hooks buttons */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={async () => {
                    const numericId = parseNumericId(alertItem.accountId);
                    if (numericId == null) {
                      showToast('Account ID could not be parsed for STR draft.', 'warning');
                      return;
                    }
                    try {
                      const url = await api.strDraftUrl({
                        account_id: numericId,
                        customer_name: alertItem.customerName,
                        counterparties: alertItem.counterparties,
                        analyst_id: 'demo-analyst',
                      });
                      window.open(url, '_blank', 'noopener');
                      showToast(`STR draft generated for ${alertItem.accountId.slice(0, 18)}…`, 'success');
                    } catch (err: any) {
                      showToast(`Failed to generate STR draft: ${err?.message ?? 'unknown error'}`, 'warning');
                    }
                  }}
                  className="flex-1 py-3.5 border border-slate-300 bg-white hover:bg-slate-50 rounded-2xl font-bold text-xs text-slate-700 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] shadow-sm"
                  title="Generate a FIU-IND STR draft PDF for this account"
                >
                  <FileDown className="h-4 w-4 shrink-0" />
                  Generate STR Draft
                </button>

                <button
                  disabled={!playbookComplete}
                  onClick={handleMarkFP}
                  className={`flex-1 py-3.5 border rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] ${
                    playbookComplete 
                      ? 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700 shadow-sm cursor-pointer' 
                      : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <RotateCw className="h-4 w-4 shrink-0" />
                  Mark False Positive
                </button>

                <button
                  disabled={!playbookComplete || isBlocked}
                  onClick={handleExecuteFreeze}
                  className={`flex-1 py-3.5 text-white font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] shadow-sm ${
                    isBlocked 
                      ? 'bg-[#419E73] border border-[#419E73]/10 text-white cursor-not-allowed shadow-none' 
                      : playbookComplete
                        ? 'bg-[#DC2626] hover:bg-red-700 cursor-pointer shadow-md shadow-red-950/10'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Lock className="h-4 w-4 shrink-0" />
                  {isBlocked ? 'Enforcement Frozen' : 'Execute System Freeze'}
                </button>
              </div>

              {/* Compliance checklist instruction footer */}
              {!playbookComplete && (
                <div className="text-[9px] text-[#DC2626] text-center font-bold tracking-wide mt-2 animate-pulse">
                  ⚠️ Auditing checklist is required prior to filing system freezes or bypasses.
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ==========================================
          VIEW: MODEL REGISTRY & ANALYTICS
          ========================================== */}
      {currentView === 'registry' && (
        <div className="space-y-6 animate-fadeIn">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-800 font-sans">Model Registry & AML Analytics</h2>
            <p className="text-xs text-slate-400 mt-1.5 font-medium">Verify production kernel performance parameters, calibration bounds, and regulatory compliance logs.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Left calibration card */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.02)] space-y-4">
              <h3 className="text-sm font-bold text-slate-800 font-sans border-b border-slate-100 pb-2">Active Kernel Stats</h3>
              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60 flex justify-between">
                  <span className="text-slate-400">Brier Score:</span>
                  <span className="text-[#0F5132] font-black">0.0024</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60 flex justify-between">
                  <span className="text-slate-400">PR-AUC Area:</span>
                  <span className="text-[#0F5132] font-black">0.87</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60 flex justify-between">
                  <span className="text-slate-400">Calibration:</span>
                  <span className="text-slate-700 font-bold">Isotonic Calibration</span>
                </div>
              </div>
            </div>

            {/* Middle analytics explanation */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.02)] space-y-3.5">
              <h3 className="text-sm font-bold text-slate-800 font-sans border-b border-slate-100 pb-2">Compliance parameters</h3>
              <p className="text-xs text-slate-500 font-sans leading-relaxed">
                Our machine auditor utilizes the RBI FREE-AI standard directives, scoring transaction signals strictly within calibrated probability boundaries. Outlier ledger streams trigger immediate human Nodal officer reviews.
              </p>
              <div className="p-3 bg-[#0F5132]/5 border border-[#419E73]/20 rounded-2xl text-[10.5px] text-[#0F5132] font-sans">
                <strong>FREE-AI Directive:</strong> All high-risk accounts (&ge;0.70 score) are automatically routed into the triage console queue within a 15-minute SLA.
              </div>
            </div>

            {/* Right downloads card */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800 font-sans border-b border-slate-100 pb-2">Download Center</h3>
                <p className="text-xs text-slate-500 font-sans leading-relaxed mt-2.5">
                  Request offline Nodal audit reports, parameter coefficients, or SHA255 verification logs.
                </p>
              </div>
              
              <button
                onClick={() => {
                  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
                  window.open(`${apiUrl}/docs/audit-report`, '_blank', 'noopener');
                  showToast('Data audit PDF opened in new tab', 'success');
                }}
                className="w-full py-3.5 bg-[#0F5132] hover:bg-[#14532D] text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-950/15"
              >
                <FileDown className="h-4 w-4" /> Download Audit Report
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ==========================================
          VIEW: NODAL OFFICER NETWORK (TWO-TAB CONSOLE VIEW)
          ========================================== */}
      {currentView === 'network' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header titles */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-800 font-sans">Nodal Officer Network</h2>
              <p className="text-xs text-slate-400 mt-1.5 font-medium">Coordinate anti-money laundering investigations, escalations, and cross-channel enforcement blocks.</p>
            </div>

            <div className="flex bg-slate-100/60 p-0.5 rounded-2xl border border-slate-200/60 w-fit shrink-0 font-mono text-[11px] shadow-sm select-none">
              <button
                onClick={() => setNodalNetworkTab('topology')}
                className={`px-4 py-2 rounded-xl transition-all shrink-0 font-semibold ${
                  nodalNetworkTab === 'topology'
                    ? 'bg-[#0F5132] text-white border border-transparent shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}
              >
                Syndicate Network Topology Map
              </button>
              
              <button
                onClick={() => setNodalNetworkTab('team')}
                className={`px-4 py-2 rounded-xl transition-all shrink-0 font-semibold ${
                  nodalNetworkTab === 'team'
                    ? 'bg-[#0F5132] text-white border border-transparent shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent'
                }`}
              >
                Active Nodal Officers
              </button>
            </div>
          </div>

          {/* Real behavioral-similarity cluster — computed from cosine
              similarity of top-20 SHAP features across the highest-scoring
              alerts. Production swap: real transaction edges from Kafka. */}
          {nodalNetworkTab === 'topology' && <BehavioralCluster />}

          {/* TAB 1: Draggable Network Topology (decorative narrative graph) */}
          {nodalNetworkTab === 'topology' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
              {/* SVG interactive network panel */}
              <div className={`xl:col-span-2 bg-white border border-slate-200/80 rounded-3xl p-5 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.02)] space-y-4 relative ${
                isNodalFS ? 'fixed inset-4 z-50 bg-white border-2 p-6 shadow-2xl rounded-3xl flex flex-col justify-between overflow-hidden' : ''
              }`}>
                {isNodalFS && (
                  <div className="pb-3 border-b flex items-center justify-between mb-4 shrink-0">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-[#0F5132]" />
                      <h3 className="text-sm font-bold text-slate-850 font-sans">Syndicate Money Laundering Topology Visualizer</h3>
                    </div>
                    <button 
                      onClick={() => setIsNodalFS(false)}
                      className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-full border text-slate-500 hover:text-slate-800 transition-all shadow-sm"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#0F5132] font-mono flex items-center gap-1.5">
                      <Activity className="h-4 w-4" /> Syndicate Network Map
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-1 font-semibold font-mono uppercase">Interactive node sandbox</p>
                  </div>
                  
                  <button 
                    onClick={() => setIsNodalFS(!isNodalFS)} 
                    className="p-1.5 hover:bg-slate-50 rounded border border-slate-200/80 text-slate-400 hover:text-slate-700 transition-colors shadow-sm shrink-0"
                    title={isNodalFS ? "Compress Topology" : "Expand Fullscreen"}
                  >
                    {isNodalFS ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </button>
                </div>

                <div className="relative w-full overflow-hidden bg-slate-50/50 rounded-2xl p-2 border border-slate-200/50 flex-1 flex flex-col" style={{ height: isNodalFS ? 'calc(100vh - 160px)' : '380px' }}>
                  <div className="absolute top-3 left-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-1.5 z-10 select-none">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626] animate-pulse" /> Draggable Money Trails (Source &rarr; Mule &rarr; Exit Hops)
                  </div>

                  <svg 
                    ref={nodalSvgRef}
                    className="w-full h-full border border-slate-200/40 rounded-xl bg-white cursor-crosshair shadow-inner flex-1"
                    onMouseMove={handleNodalMouseMove}
                    onMouseUp={handleNodalMouseUp}
                    onMouseLeave={handleNodalMouseUp}
                    viewBox="0 0 800 320"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <defs>
                      <marker id="arrow-nodal" viewBox="0 0 10 10" refX="18" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748B" />
                      </marker>
                      <marker id="arrow-green" viewBox="0 0 10 10" refX="18" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#0F5132" />
                      </marker>
                      <marker id="arrow-red" viewBox="0 0 10 10" refX="18" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#DC2626" />
                      </marker>
                    </defs>

                    {/* Connection paths */}
                    {nodalTopologyNodes.map((node) => {
                      if (node.id === 'MULE') return null;
                      const muleNode = nodalTopologyNodes[2]; // Mule is third node
                      const isSource = node.id.startsWith('SRC');
                      const isHop = node.id.startsWith('HOP');
                      const isExit = node.id.startsWith('EXIT');

                      // Source -> Mule
                      if (isSource) {
                        return (
                          <g key={`nodal-line-${node.id}`}>
                            <line
                              x1={node.x}
                              y1={node.y}
                              x2={muleNode.x}
                              y2={muleNode.y}
                              stroke="#0F5132"
                              strokeWidth="2.5"
                              strokeDasharray="2,3"
                              markerEnd="url(#arrow-green)"
                            />
                            <text
                              x={(node.x + muleNode.x) / 2}
                              y={(node.y + muleNode.y) / 2 - 5}
                              textAnchor="middle"
                              fill="#0F5132"
                              fontSize="8"
                              fontWeight="bold"
                              className="pointer-events-none select-none font-mono"
                            >
                              ₹{Math.floor(node.volume / 1000)}k
                            </text>
                          </g>
                        );
                      }

                      // Mule -> Hop
                      if (isHop) {
                        return (
                          <g key={`nodal-line-${node.id}`}>
                            <line
                              x1={muleNode.x}
                              y1={muleNode.y}
                              x2={node.x}
                              y2={node.y}
                              stroke="#DC2626"
                              strokeWidth="2.5"
                              markerEnd="url(#arrow-red)"
                            />
                            <text
                              x={(muleNode.x + node.x) / 2}
                              y={(muleNode.y + node.y) / 2 - 5}
                              textAnchor="middle"
                              fill="#DC2626"
                              fontSize="8"
                              fontWeight="bold"
                              className="pointer-events-none select-none font-mono"
                            >
                              ₹{Math.floor(node.volume / 1000)}k
                            </text>
                          </g>
                        );
                      }

                      // Hop -> Exit
                      if (isExit) {
                        // EXIT1/2 connect to HOP1, EXIT3 connects to HOP2
                        const parentHop = node.id === 'EXIT3' ? nodalTopologyNodes[4] : nodalTopologyNodes[3];
                        return (
                          <g key={`nodal-line-${node.id}`}>
                            <line
                              x1={parentHop.x}
                              y1={parentHop.y}
                              x2={node.x}
                              y2={node.y}
                              stroke="#64748B"
                              strokeWidth="2"
                              strokeDasharray="4,4"
                              markerEnd="url(#arrow-nodal)"
                            />
                            <text
                              x={(parentHop.x + node.x) / 2}
                              y={(parentHop.y + node.y) / 2 - 5}
                              textAnchor="middle"
                              fill="#64748B"
                              fontSize="8"
                              fontWeight="bold"
                              className="pointer-events-none select-none font-mono"
                            >
                              ₹{Math.floor(node.volume / 1000)}k
                            </text>
                          </g>
                        );
                      }

                      return null;
                    })}

                    {/* Nodes group */}
                    {nodalTopologyNodes.map((node) => {
                      const activeNode = selectedNodalNode || nodalTopologyNodes[2];
                      const isSelected = activeNode.id === node.id;
                      
                      return (
                        <g 
                          key={node.id}
                          className="cursor-move group"
                          onMouseDown={() => {
                            handleNodalMouseDown(node.id);
                            handleNodalNodeClick(node);
                          }}
                        >
                          {/* Glowing selection ring */}
                          {isSelected && (
                            <circle
                              cx={node.x}
                              cy={node.y}
                              r={node.r + 5}
                              fill="none"
                              stroke={node.id === 'MULE' || node.id.startsWith('HOP') ? '#DC2626' : node.id.startsWith('SRC') ? '#0F5132' : '#64748B'}
                              strokeWidth="2.5"
                              className="animate-pulse"
                            />
                          )}

                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={node.r}
                            fill={node.fill}
                            className="shadow-md transition-colors"
                          />

                          <text
                            x={node.x}
                            y={node.y + 4}
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize="9"
                            fontWeight="bold"
                            className="pointer-events-none select-none font-mono"
                          >
                            {node.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* Node Detail Inspector panel */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.02)] space-y-4 select-none">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#0F5132] font-mono flex items-center gap-1.5 border-b border-slate-100 pb-3">
                  <Info className="h-4 w-4 text-[#0F5132]" /> Node Information Sheet
                </h3>

                {(() => {
                  const activeNode = selectedNodalNode || nodalTopologyNodes[2];
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-base font-bold text-slate-800 font-sans">{activeNode.label}</h4>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{activeNode.id}</p>
                        </div>
                        <span className="text-[10px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-mono text-slate-700 font-bold shadow-sm">
                          {activeNode.channel}
                        </span>
                      </div>

                      <div className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-2xl space-y-3 font-sans text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Status Description</span>
                          <div className="font-semibold text-slate-700 mt-1 leading-normal">{activeNode.details}</div>
                        </div>

                        <div className="grid grid-cols-2 gap-3.5 border-t border-slate-200/60 pt-2.5">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Risk Flag</span>
                            <div className={`font-black mt-0.5 font-mono ${
                              activeNode.id === 'MULE' || activeNode.id.startsWith('HOP') ? 'text-[#DC2626]' : activeNode.id.startsWith('SRC') ? 'text-[#0F5132]' : 'text-slate-500'
                            }`}>
                              {activeNode.status}
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wide">Volume Routed</span>
                            <div className="font-bold text-slate-800 mt-0.5 font-mono">₹{activeNode.volume.toLocaleString()}</div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2">
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(activeNode.details);
                            showToast(`Copied details for node ${activeNode.label}`, "success");
                          }}
                          className="w-full py-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
                        >
                          <Copy className="h-3.5 w-3.5 text-slate-400" />
                          Copy Node Specifications
                        </button>

                        <button 
                          onClick={() => {
                            if (activeNode.id === 'MULE') {
                              setSelectedAlertId('MULE_AC_9082_30A2');
                              setCurrentView('triage');
                            } else {
                              setInquiryStep(1);
                              setInquiryType('Asset freeze');
                              setInquiryNotes('');
                              setIsInquiryOpen(true);
                            }
                          }}
                          className="w-full py-3 bg-[#0F5132] hover:bg-[#14532D] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {activeNode.id === 'MULE' ? 'Triage Mule Core Hub' : 'Investigate Node Trail'}
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* TAB 2: Nodal Officers list */}
          {nodalNetworkTab === 'team' && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.02)] space-y-4">
              <h3 className="text-sm font-bold text-slate-800 font-sans border-b border-slate-100 pb-2">Active Nodal Officers</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {[
                  { name: 'Totok Michael', role: 'Lead Fraud Analyst', dept: 'Level-2 Compliance escalations', initial: 'TM' },
                  { name: 'Alexandra Deff', role: 'Nodal Officer Coordinator', dept: 'FIU-IND liaison operations', initial: 'AD' },
                  { name: 'Edwin Adenike', role: 'Behavioral Auditor', dept: 'Ledger signal verification', initial: 'EA' },
                  { name: 'Isaac Oluwatemilorun', role: 'Compliance Officer', dept: 'Regulatory compliance review', initial: 'IO' }
                ].map((member, idx) => (
                  <div key={idx} className="border border-slate-200/80 p-5 rounded-2xl bg-slate-50/30 flex flex-col items-center text-center gap-3 select-none">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-[#0F5132] to-[#419E73] flex items-center justify-center text-white font-mono font-bold shadow-md">
                      {member.initial}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{member.name}</h4>
                      <p className="text-[9.5px] text-[#0F5132] font-semibold mt-0.5">{member.role}</p>
                      <p className="text-[9.5px] text-slate-400 font-sans mt-2">{member.dept}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          CASE FILING & SYNDICATE NODE INQUIRY WIZARD MODAL
          ========================================== */}
      {isInquiryOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg border border-slate-200 shadow-2xl p-6 relative overflow-hidden select-none animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-[#0F5132]" />
                <div>
                  <h3 className="text-sm font-bold text-slate-850 font-sans">Syndicate Node Deep Inquiry</h3>
                  <p className="text-[10px] text-slate-400 font-mono uppercase mt-0.5">FIU-IND Case Filing Wizard</p>
                </div>
              </div>
              <button 
                onClick={() => setIsInquiryOpen(false)}
                className="p-1 bg-slate-50 hover:bg-slate-100 rounded-full border text-slate-400 hover:text-slate-600 transition-all shadow-sm"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Stepper indicator */}
            <div className="flex items-center justify-between px-2 mb-6 select-none font-mono text-[9px] font-bold text-slate-400">
              <div className={`flex items-center gap-1.5 ${inquiryStep >= 1 ? 'text-[#0F5132]' : ''}`}>
                <span className={`h-5 w-5 rounded-full flex items-center justify-center border font-black ${inquiryStep === 1 ? 'bg-[#0F5132] text-white border-transparent' : inquiryStep > 1 ? 'bg-emerald-50 border-[#419E73] text-[#0F5132]' : 'border-slate-200'}`}>1</span>
                <span>CREDENTIALS</span>
              </div>
              <div className="h-px bg-slate-200 flex-1 mx-3" />
              <div className={`flex items-center gap-1.5 ${inquiryStep >= 2 ? 'text-[#0F5132]' : ''}`}>
                <span className={`h-5 w-5 rounded-full flex items-center justify-center border font-black ${inquiryStep === 2 ? 'bg-[#0F5132] text-white border-transparent' : inquiryStep > 2 ? 'bg-emerald-50 border-[#419E73] text-[#0F5132]' : 'border-slate-200'}`}>2</span>
                <span>STRATEGY</span>
              </div>
              <div className="h-px bg-slate-200 flex-1 mx-3" />
              <div className={`flex items-center gap-1.5 ${inquiryStep >= 3 ? 'text-[#0F5132]' : ''}`}>
                <span className={`h-5 w-5 rounded-full flex items-center justify-center border font-black ${inquiryStep === 3 ? 'bg-[#0F5132] text-white border-transparent' : inquiryStep > 3 ? 'bg-emerald-50 border-[#419E73] text-[#0F5132]' : 'border-slate-200'}`}>3</span>
                <span>REMARKS</span>
              </div>
              <div className="h-px bg-slate-200 flex-1 mx-3" />
              <div className={`flex items-center gap-1.5 ${inquiryStep >= 4 ? 'text-[#0F5132]' : ''}`}>
                <span className={`h-5 w-5 rounded-full flex items-center justify-center border font-black ${inquiryStep === 4 ? 'bg-[#0F5132] text-white border-transparent' : 'border-slate-200'}`}>4</span>
                <span>SUBMIT</span>
              </div>
            </div>

            {/* Content per Step */}
            <div className="min-h-[180px] bg-slate-50/50 border border-slate-200/60 p-4.5 rounded-2xl mb-5 font-sans text-xs">
              
              {/* Step 1: Suspect Credentials */}
              {inquiryStep === 1 && selectedNodalNode && (
                <div className="space-y-3.5">
                  <div className="p-3 bg-white border border-slate-200/80 rounded-xl space-y-2">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">Suspect Target Information</span>
                    <div className="flex justify-between items-center text-slate-700 font-mono text-[11px] font-bold">
                      <span>Node ID:</span>
                      <span className="text-slate-800 select-all">{selectedNodalNode.id}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-700 font-mono text-[11px] font-bold">
                      <span>Target Name:</span>
                      <span className="text-slate-850 font-sans">{selectedNodalNode.label} ({selectedNodalNode.status})</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-700 font-mono text-[11px] font-bold">
                      <span>Flow Volume:</span>
                      <span className="text-[#DC2626]">₹{selectedNodalNode.volume.toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Please confirm the suspected syndicate trail specifications before proceeding to regulatory action routing.
                  </p>
                </div>
              )}

              {/* Step 2: Choose Inquiry Type */}
              {inquiryStep === 2 && (
                <div className="space-y-3">
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest font-mono">Select Enforcement Strategy</span>
                  <div className="grid grid-cols-1 gap-2.5">
                    {[
                      { type: 'Asset freeze', label: 'Emergency Asset Freeze', desc: 'Lock active ledger incoming/outgoing routes immediately.' },
                      { type: 'Identity trace', label: 'Bureau Identity Trace', desc: 'File formal lookup with KYC database registrars.' },
                      { type: 'RTGS hold', label: 'RTGS High-Value Hold', desc: 'Hold clearing cycle processing for 48 hours.' }
                    ].map((opt) => (
                      <label key={opt.type} className={`p-3 border rounded-xl flex items-start gap-3 cursor-pointer select-none transition-all ${inquiryType === opt.type ? 'bg-emerald-50/50 border-[#419E73] text-[#0F5132]' : 'bg-white border-slate-200 hover:border-slate-350'}`}>
                        <input 
                          type="radio" 
                          name="inquiryType" 
                          value={opt.type} 
                          checked={inquiryType === opt.type} 
                          onChange={() => setInquiryType(opt.type)}
                          className="mt-0.5 h-3.5 w-3.5 text-[#0F5132] focus:ring-[#419E73]"
                        />
                        <div>
                          <div className="font-bold text-xs">{opt.label}</div>
                          <div className="text-[9.5px] text-slate-400 mt-0.5">{opt.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Investigator Remarks */}
              {inquiryStep === 3 && (
                <div className="space-y-2.5">
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest font-mono">Audit Observations</span>
                  <textarea
                    rows={4}
                    placeholder="Enter precise forensic trails observed, structuring behaviors, or victim transaction hashes..."
                    value={inquiryNotes}
                    onChange={(e) => setInquiryNotes(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-[#0F5132] focus:outline-none rounded-xl p-3 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm"
                  />
                  <div className="text-[9px] text-slate-400 leading-relaxed font-sans">
                    * Remarks are permanently cataloged inside the RBI Audit Ledger and can be subpoenaed during litigation.
                  </div>
                </div>
              )}

              {/* Step 4: Preview Template Case Draft */}
              {inquiryStep === 4 && selectedNodalNode && (
                <div className="space-y-3.5">
                  <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest font-mono">STR Case Filing Preview</span>
                  
                  <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-slate-300 font-mono text-[9px] leading-relaxed max-h-[140px] overflow-y-auto shadow-inner select-all">
                    <div>[DRAFT SECURE FIU-IND REPORT]</div>
                    <div>SEC_REG: {Math.random().toString(36).substring(2, 10).toUpperCase()}</div>
                    <div>TIMESTAMP: {new Date().toISOString()}</div>
                    <div>SUSPECT: {selectedNodalNode.id}</div>
                    <div>ENFORCEMENT: {inquiryType.toUpperCase()}</div>
                    <div>VOLUME: INR {selectedNodalNode.volume.toLocaleString()}</div>
                    <div>REMARKS: {inquiryNotes || 'No notes appended.'}</div>
                    <div>CHECKSUM_SHA256: {Array.from({length:32}, () => Math.floor(Math.random()*16).toString(16)).join('')}</div>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    By submitting, you issue an electronic regulatory alert request to the national portal registrar.
                  </p>
                </div>
              )}

            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4 gap-3 shrink-0">
              <button
                disabled={inquiryStep === 1}
                onClick={() => setInquiryStep(prev => prev - 1)}
                className={`px-4 py-2.5 border rounded-xl text-xs font-bold transition-all ${inquiryStep === 1 ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed' : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700 shadow-sm'}`}
              >
                Back
              </button>

              {inquiryStep < 4 ? (
                <button
                  onClick={() => {
                    if (inquiryStep === 3 && inquiryNotes.trim() === '') {
                      showToast("Please input forensic audit remarks before continuing.", "warning");
                      return;
                    }
                    setInquiryStep(prev => prev + 1);
                  }}
                  className="px-5 py-2.5 bg-[#0F5132] hover:bg-[#14532D] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                >
                  Continue <ChevronRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (!selectedNodalNode) return;
                    
                    const channel = selectedNodalNode.channel.split(' ')[0] || 'UPI';
                    const targetIdHash = `AC_${selectedNodalNode.id.substring(0, 4)}_${Math.floor(1000 + Math.random() * 9000)}`;
                    const logStatus = inquiryType === 'Asset freeze' ? 'STR Draft / Frozen Enforced' : inquiryType === 'Identity trace' ? 'Identity Verification Request' : 'High-Value Hold Engaged';
                    
                    addRecentLog({
                      channel,
                      id: targetIdHash,
                      time: new Date().toTimeString().split(' ')[0] + ' UTC',
                      status: logStatus,
                      color: inquiryType === 'Asset freeze' ? 'text-red-650 bg-red-50 border-red-100' : 'text-amber-700 bg-amber-50 border-amber-100'
                    });
                    
                    showToast(`Official STR filed successfully under Checksum: ${targetIdHash}`, 'success');
                    setIsInquiryOpen(false);
                  }}
                  className="px-5 py-2.5 bg-[#DC2626] hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-red-950/15 flex items-center gap-1.5 animate-pulse"
                >
                  <ShieldAlert className="h-4 w-4" /> Submit Official Case Filing
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
