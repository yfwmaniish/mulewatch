'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAlerts, AnalystFeedItem, ActionLogItem } from '@/context/AlertContext';
import { 
  X, 
  Sliders, 
  HelpCircle, 
  Download, 
  Lock, 
  ShieldCheck, 
  Check, 
  ShieldAlert, 
  Users, 
  Activity, 
  Cpu, 
  Terminal, 
  MapPin, 
  CheckSquare, 
  Clock, 
  Play, 
  RefreshCw,
  Send,
  AlertTriangle,
  LockKeyhole,
  FileCheck2,
  BookmarkCheck
} from 'lucide-react';

export default function DonezoOverlays() {
  const {
    isSettingsOpen, setIsSettingsOpen,
    isHelpOpen, setIsHelpOpen,
    isModelCardOpen, setIsModelCardOpen,
    isAddNodalOpen, setIsAddNodalOpen,
    isCfcOpen, setIsCfcOpen,
    isBaselineOpen, setIsBaselineOpen,
    isCaptureStatsOpen, setIsCaptureStatsOpen,
    isLockscreenActive, setIsLockscreenActive,
    
    analysts, addAnalyst,
    recentLogs, addRecentLog,
    settings, updateSettings,
    toast, showToast, hideToast
  } = useAlerts();

  // Settings local state during adjustments
  const [localBoundary, setLocalBoundary] = useState(settings.decisionBoundary);
  const [localFanout, setLocalFanout] = useState(settings.upiFanoutLimit);
  const [localDormancy, setLocalDormancy] = useState(settings.dormancyLimitDays);
  const [localHold, setLocalHold] = useState(settings.autoHoldLeg);
  const [localForce, setLocalForce] = useState(settings.forceGov14cLock);

  useEffect(() => {
    setLocalBoundary(settings.decisionBoundary);
    setLocalFanout(settings.upiFanoutLimit);
    setLocalDormancy(settings.dormancyLimitDays);
    setLocalHold(settings.autoHoldLeg);
    setLocalForce(settings.forceGov14cLock);
  }, [settings, isSettingsOpen]);

  const handleSaveSettings = () => {
    updateSettings({
      decisionBoundary: localBoundary,
      upiFanoutLimit: localFanout,
      dormancyLimitDays: localDormancy,
      autoHoldLeg: localHold,
      forceGov14cLock: localForce
    });
    setIsSettingsOpen(false);
  };

  // Chatbot state
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string; time: string }>>([
    { sender: 'ai', text: 'Welcome to the MuleWatch Regulatory AI Assistant. I am calibrated with active RBI anti-money laundering circulars and FIU-IND compliance directives. How can I assist you today?', time: '02:15' }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSendChat = (text: string) => {
    if (!text.trim()) return;
    
    const timeStr = new Date().toTimeString().substring(0, 5);
    setMessages((prev) => [...prev, { sender: 'user', text, time: timeStr }]);
    setUserInput('');
    setIsTyping(true);

    // Simulate AI response based on questions
    setTimeout(() => {
      let reply = "Under Sec 12 of the Prevention of Money Laundering Act (PMLA), financial entities must verify identities of all active counterparties. GNN anomalies showing structured fan-outs below ₹50,000 should be immediately locked for outbound routing.";
      
      const q = text.toLowerCase();
      if (q.includes('14c') || q.includes('government')) {
        reply = "Government Circular 14C mandates instant freeze constraints on accounts flagged by the Cyber Crime Coordination Centre (I4C). No Level-2 validation is required for initial 48-hour emergency suspensions.";
      } else if (q.includes('structuring') || q.includes('49')) {
        reply = "Transaction structuring involves breaking a large transaction into smaller sums (e.g. ₹49,990) to avoid regulatory trigger thresholds like the ₹50,000 PAN verification constraint. MuleWatch flags these with high-precision neural scores.";
      } else if (q.includes('isotonic') || q.includes('recall')) {
        reply = "Isotonic calibration rescales raw machine learning scores into highly calibrated empirical probability assessments. A score of 0.89 indicates a verified 89% historic true-positive rate, optimizing triage accuracy.";
      } else if (q.includes('baseline')) {
        reply = "The Baseline Pool (9,082 monitored accounts) establishes regular operational signatures. Transactions deviating by more than 3.5 standard deviations in geographic proximity or speed trigger immediate active warnings.";
      }

      setMessages((prev) => [...prev, { sender: 'ai', text: reply, time: timeStr }]);
      setIsTyping(false);
    }, 900);
  };

  // Add Nodal form local state
  const [nodalName, setNodalName] = useState('');
  const [nodalRole, setNodalRole] = useState('Compliance Coordinator');
  const [nodalNode, setNodalNode] = useState('AML_NODE_MUMBAI');

  const handleAddNodalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nodalName.trim()) return;

    const newNodal: AnalystFeedItem = {
      name: nodalName,
      task: `MULE_AC_${Math.floor(1000 + Math.random() * 9000)}_REG`,
      status: 'In Progress',
      color: 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
    };

    addAnalyst(newNodal);
    showToast(`Nodal investigator "${nodalName}" assigned successfully to dynamic triage stream!`, 'success');
    setNodalName('');
    setIsAddNodalOpen(false);
  };

  // In-modal Emergency Govt Lock action
  const [cfcLogsLocked, setCfcLogsLocked] = useState<string[]>([]);
  const handleCfcFreeze = (accId: string) => {
    if (cfcLogsLocked.includes(accId)) return;
    setCfcLogsLocked(prev => [...prev, accId]);
    showToast(`Emergency 14C Government Freeze enforced immediately on: ${accId}`, 'warning');
    addRecentLog({
      channel: 'GOV_14C',
      id: accId,
      time: new Date().toTimeString().substring(0, 8) + ' UTC',
      status: 'Emergency Lock Active',
      color: 'text-red-650 bg-red-50 border-red-100'
    });
  };

  return (
    <>
      {/* ==========================================
          GLOBAL FLOATING TOAST
          ========================================== */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[9999] p-4 rounded-2xl shadow-2xl flex items-center gap-3 border animate-bounce max-w-md ${
          toast.type === 'success' ? 'bg-[#0F5132] text-white border-[#419E73]/30' : 'bg-red-800 text-white border-red-500/30'
        }`}>
          <div className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            {toast.type === 'success' ? <Check className="h-4 w-4 text-emerald-300" /> : <Lock className="h-4 w-4 text-red-300" />}
          </div>
          <div className="text-xs font-semibold font-sans leading-tight flex-1">
            {toast.message}
          </div>
          <button onClick={hideToast} className="text-white/60 hover:text-white shrink-0 ml-1.5 p-0.5 hover:bg-white/10 rounded">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ==========================================
          1. SETTINGS OVERLAY DRAWER
          ========================================== */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[1000] flex justify-end select-none">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/35 backdrop-blur-xs transition-opacity" onClick={() => setIsSettingsOpen(false)} />
          
          {/* Panel */}
          <div className="relative w-[440px] max-w-full bg-white h-screen shadow-2xl p-8 flex flex-col justify-between overflow-y-auto border-l border-slate-200 animate-slideLeft z-10 font-sans">
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-[#0F5132]/10 flex items-center justify-center text-[#0F5132]">
                    <Sliders className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">System Risk Controls</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Calibrate machine thresholds and limits</p>
                  </div>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Sliders and Controls */}
              <div className="mt-8 space-y-7">
                
                {/* Score Boundary Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">ML Triage Score Boundary</label>
                    <span className="text-xs font-bold font-mono text-[#0F5132] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                      {(localBoundary * 100).toFixed(0)}% Score
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-450 leading-normal">
                    Transactions scoring above this boundary will be routed to the Active Triage list immediately. Lowering will capture more marginal candidates.
                  </p>
                  <input 
                    type="range" 
                    min="0.50" 
                    max="0.95" 
                    step="0.05"
                    value={localBoundary}
                    onChange={(e) => setLocalBoundary(parseFloat(e.target.value))}
                    className="w-full accent-[#0F5132] h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] font-mono text-slate-400">
                    <span>0.50 (Sensitive)</span>
                    <span>0.95 (Strict)</span>
                  </div>
                </div>

                {/* UPI Limit Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">UPI Fan-out Count Limit</label>
                    <span className="text-xs font-bold font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {localFanout} Accounts
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-450 leading-normal">
                    The maximum number of low-history recipient accounts in a 3-hour window before triggering a rapid fan-out structuring rule mismatch.
                  </p>
                  <input 
                    type="range" 
                    min="10" 
                    max="100" 
                    step="5"
                    value={localFanout}
                    onChange={(e) => setLocalFanout(parseInt(e.target.value))}
                    className="w-full accent-[#0F5132] h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] font-mono text-slate-400">
                    <span>10 Min</span>
                    <span>100 Max</span>
                  </div>
                </div>

                {/* Dormancy Warning Limit */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Dormancy Trigger Threshold</label>
                    <span className="text-xs font-bold font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {localDormancy} Days
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-450 leading-normal">
                    The minimum period of account inactivity before a sudden, high-volume credit is categorized as a high-risk "Dormancy Break" anomaly.
                  </p>
                  <input 
                    type="range" 
                    min="30" 
                    max="360" 
                    step="15"
                    value={localDormancy}
                    onChange={(e) => setLocalDormancy(parseInt(e.target.value))}
                    className="w-full accent-[#0F5132] h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[9px] font-mono text-slate-400">
                    <span>30 Days</span>
                    <span>360 Days</span>
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Auto-Hold Outgoing Leg</h4>
                      <p className="text-[9.5px] text-slate-400">Lock fund splits automatically on high probability hits.</p>
                    </div>
                    <button 
                      onClick={() => setLocalHold(!localHold)}
                      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                        localHold ? 'bg-[#0F5132]' : 'bg-slate-200'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        localHold ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">Force Gov 14C Lock</h4>
                      <p className="text-[9.5px] text-slate-400">Enable automatic freeze sequences for all CFCFRMS database hits.</p>
                    </div>
                    <button 
                      onClick={() => setLocalForce(!localForce)}
                      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                        localForce ? 'bg-[#0F5132]' : 'bg-slate-200'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        localForce ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Save Button */}
            <div className="pt-6 border-t border-slate-100 flex items-center gap-3">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-650 text-xs font-bold rounded-2xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveSettings}
                className="flex-1 py-3 bg-[#0F5132] hover:bg-[#14532D] text-white text-xs font-bold rounded-2xl transition-all shadow-md shadow-emerald-950/10"
              >
                Apply Thresholds
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          2. COMPLIANCE AI CHATBOT DRAWER
          ========================================== */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-[1000] flex justify-end select-none">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/35 backdrop-blur-xs transition-opacity" onClick={() => setIsHelpOpen(false)} />
          
          {/* Panel */}
          <div className="relative w-[440px] max-w-full bg-[#F8FAFC] h-screen shadow-2xl flex flex-col justify-between overflow-hidden border-l border-slate-200 animate-slideLeft z-10 font-sans">
            
            {/* Header */}
            <div className="p-6 bg-white border-b border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-[#0F5132]/10 flex items-center justify-center text-[#0F5132] font-black">
                  <HelpCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Compliance AI Helpdesk</h3>
                  <p className="text-[10px] text-slate-400 font-medium font-mono uppercase">RBI FREE-AI Core Engine</p>
                </div>
              </div>
              <button onClick={() => setIsHelpOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Chat Timeline Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`p-3.5 rounded-2xl text-xs max-w-[85%] font-sans leading-relaxed shadow-xs border ${
                    msg.sender === 'user' 
                      ? 'bg-[#0F5132] text-white border-emerald-800 rounded-tr-none' 
                      : 'bg-white text-slate-800 border-slate-200/70 rounded-tl-none'
                  }`}>
                    {msg.text}
                  </div>
                  <span className="text-[8px] font-mono text-slate-400 font-bold mt-1 px-1">{msg.time}</span>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex flex-col items-start animate-pulse">
                  <div className="bg-white border border-slate-200/70 p-3.5 rounded-2xl rounded-tl-none text-xs text-slate-400 font-mono italic">
                    Compliance Engine analyzing regulatory charts...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Presets and Input */}
            <div className="p-4 bg-white border-t border-slate-200/80 space-y-3">
              {/* Question Presets Chips */}
              <div className="flex flex-wrap gap-1.5 pb-2">
                {[
                  { text: 'What is RBI circular 14C?', short: 'RBI Circular 14C' },
                  { text: 'Explain UPI ₹49,990 structuring limits.', short: 'UPI Structuring ₹49.9k' },
                  { text: 'How is the Isotonic Recall calibrated?', short: 'Calibrated Recall' },
                  { text: 'What does the Baseline Pool monitor?', short: 'Baseline Pool details' }
                ].map((item, idx) => (
                  <button 
                    key={idx}
                    onClick={() => handleSendChat(item.text)}
                    className="text-[9px] font-bold text-slate-600 hover:text-[#0F5132] bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 px-2 py-1 rounded-full transition-all shadow-xs"
                  >
                    {item.short}
                  </button>
                ))}
              </div>

              {/* Message Typing Input */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChat(userInput);
                }}
                className="flex items-center gap-2 border border-slate-250 rounded-2xl p-1.5 bg-slate-50/50 shadow-inner"
              >
                <input 
                  type="text"
                  placeholder="Ask compliance agent circulars..."
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  className="w-full bg-transparent text-xs text-slate-800 pl-2.5 outline-none placeholder:text-slate-400 placeholder:font-sans font-medium"
                />
                <button 
                  type="submit"
                  className="h-9 w-9 rounded-xl bg-[#0F5132] hover:bg-[#14532D] text-white flex items-center justify-center shrink-0 shadow-sm transition-all"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>

          </div>
        </div>
      )}

      {/* ==========================================
          3. MODEL COMPLIANCE CARD VIEWER MODAL
          ========================================== */}
      {isModelCardOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 select-none">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setIsModelCardOpen(false)} />
          
          {/* Modal Container */}
          <div className="relative bg-white max-w-2xl w-full rounded-3xl shadow-2xl overflow-hidden border border-slate-250 flex flex-col justify-between animate-fadeIn font-sans max-h-[90vh]">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-[#0F5132]/10 flex items-center justify-center text-[#0F5132] font-black">
                  <Download className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Compliance Model Card</h3>
                  <p className="text-[10px] text-slate-400 font-mono tracking-wider font-bold">RBI_AML_MULEWATCH_v2.01</p>
                </div>
              </div>
              <button onClick={() => setIsModelCardOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Model Card Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
              
              {/* Overview */}
              <div className="bg-[#0F5132]/5 border border-[#0F5132]/10 p-4 rounded-2xl">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <BookmarkCheck className="h-4 w-4 text-[#0F5132]" />
                  Regulatory Integrity Assessment
                </h4>
                <p className="text-[10.5px] text-slate-650 mt-1.5 leading-relaxed">
                  Hybrid architecture merging Graph Neural Network (GNN) entity relational embeddings with calibrated gradient-boosted trees. Empirically certified under Isotonic Regression to map true transaction probability distribution bounds.
                </p>
              </div>

              {/* Metrics Grid */}
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Model Telemetry Performance</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Area Under ROC', val: '0.982', sub: 'Baseline 0.940' },
                    { label: 'True Capture Recall', val: '94.2%', sub: 'SLA target >90%' },
                    { label: 'Precision Accuracy', val: '89.1%', sub: 'FPR limit <1.2%' },
                    { label: 'F1 Balanced Score', val: '0.924', sub: 'Isotonic calibration' }
                  ].map((item, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl text-center shadow-xs">
                      <div className="text-[9px] font-bold text-slate-400 leading-snug">{item.label}</div>
                      <div className="text-2xl font-black text-slate-800 font-mono mt-1">{item.val}</div>
                      <div className="text-[8px] text-[#419E73] font-bold mt-1.5 uppercase font-mono">{item.sub}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Technical Specifications */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                
                {/* Architecture parameters */}
                <div className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-slate-50/30">
                  <h5 className="font-bold text-slate-800 border-b border-slate-100 pb-2">Hyperparameter Configurations</h5>
                  <table className="w-full font-mono text-[10px] text-slate-650">
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-1.5 text-slate-400">Embedding Dim</td>
                        <td className="py-1.5 text-right font-bold">128-d Relational</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-slate-400">GNN Message Steps</td>
                        <td className="py-1.5 text-right font-bold">3 Hop Convolutional</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-slate-400">Decision Trees</td>
                        <td className="py-1.5 text-right font-bold">1,200 Leafs</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-slate-400">Learning Rate</td>
                        <td className="py-1.5 text-right font-bold">0.035 (Shrinkage)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Audit Seals */}
                <div className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-slate-50/30">
                  <h5 className="font-bold text-slate-800 border-b border-slate-100 pb-2">Compliance Auditing Hashes</h5>
                  <div className="space-y-2.5 font-mono text-[9.5px]">
                    <div>
                      <span className="text-slate-400 uppercase tracking-wider block text-[8px] font-bold">SHA-256 Certificate Lock</span>
                      <span className="text-slate-700 font-bold break-all bg-white border border-slate-200 px-2 py-1 rounded block mt-0.5 shadow-xs">
                        9e88bf0a012d99bc45faeec88210ea8f0b12f4581
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 uppercase tracking-wider block text-[8px] font-bold">FIU-IND Telemetry Audit</span>
                      <span className="text-slate-700 font-bold bg-white border border-slate-200 px-2 py-1 rounded block mt-0.5 shadow-xs">
                        PASSED_Calibrated_2026_RBI_AML
                      </span>
                    </div>
                  </div>
                </div>

              </div>

            </div>

            {/* Footer Buttons */}
            <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/40">
              <span className="text-[9px] font-mono text-slate-400 font-bold">Regulatory Authority Verification Seal active.</span>
              <button
                onClick={() => {
                  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
                  window.open(`${apiUrl}/docs/model-card`, '_blank', 'noopener');
                  showToast('Model card PDF opened in new tab', 'success');
                }}
                className="px-5 py-2.5 bg-[#0F5132] hover:bg-[#14532D] text-white text-xs font-bold rounded-2xl transition-all shadow-md shadow-emerald-950/10 flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Download PDF Card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          4. "ADD NODAL OFFICER" WIZARD MODAL
          ========================================== */}
      {isAddNodalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 select-none">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setIsAddNodalOpen(false)} />
          
          {/* Modal Container */}
          <div className="relative bg-white max-w-md w-full rounded-3xl shadow-2xl overflow-hidden border border-slate-250 animate-fadeIn font-sans">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-[#0F5132]/10 flex items-center justify-center text-[#0F5132]">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Add Nodal Officer</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Assign a new human compliance auditor</p>
                </div>
              </div>
              <button onClick={() => setIsAddNodalOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddNodalSubmit} className="p-6 space-y-4">
              
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Auditor Full Name</label>
                <input 
                  type="text"
                  placeholder="e.g. Ramesh Chandra Sen"
                  value={nodalName}
                  onChange={(e) => setNodalName(e.target.value)}
                  className="w-full text-xs font-semibold px-4 py-3 bg-slate-50 border border-slate-250 rounded-2xl outline-none focus:border-[#0F5132] focus:bg-white transition-all shadow-inner"
                  required
                />
              </div>

              {/* Role Dropdown */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nodal Security Role</label>
                <select 
                  value={nodalRole}
                  onChange={(e) => setNodalRole(e.target.value)}
                  className="w-full text-xs font-semibold px-4 py-3 bg-slate-50 border border-slate-250 rounded-2xl outline-none focus:border-[#0F5132] focus:bg-white transition-all shadow-xs"
                >
                  <option value="Compliance Coordinator">Compliance Coordinator (Level-1)</option>
                  <option value="Lead AML Analyst">Lead AML Analyst (Level-2)</option>
                  <option value="Forensic Security Nodal">Forensic Security Nodal (Level-3)</option>
                  <option value="Regulatory Liaison Auditor">Regulatory Liaison Auditor (Audit)</option>
                </select>
              </div>

              {/* Node Assignment */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ingestion Node Node-ID</label>
                <select 
                  value={nodalNode}
                  onChange={(e) => setNodalNode(e.target.value)}
                  className="w-full text-xs font-semibold px-4 py-3 bg-slate-50 border border-slate-250 rounded-2xl outline-none focus:border-[#0F5132] focus:bg-white transition-all shadow-xs font-mono"
                >
                  <option value="AML_NODE_MUMBAI">AML_NODE_MUMBAI (West)</option>
                  <option value="AML_NODE_KOLKATA">AML_NODE_KOLKATA (East)</option>
                  <option value="AML_NODE_DELHI">AML_NODE_DELHI (North)</option>
                  <option value="AML_NODE_BANGALORE">AML_NODE_BANGALORE (South)</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                <button 
                  type="button"
                  onClick={() => setIsAddNodalOpen(false)}
                  className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-650 text-xs font-bold rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-[#0F5132] hover:bg-[#14532D] text-white text-xs font-bold rounded-2xl transition-all shadow-md shadow-emerald-950/10"
                >
                  Deploy Officer
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          5. GOVERNMENT 14C / CFCFRMS ACTION REGISTRY MODAL
          ========================================== */}
      {isCfcOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 select-none">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setIsCfcOpen(false)} />
          
          {/* Modal Container */}
          <div className="relative bg-white max-w-lg w-full rounded-3xl shadow-2xl overflow-hidden border border-slate-250 animate-fadeIn font-sans">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-red-50/40">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-red-100 flex items-center justify-center text-[#DC2626] font-black">
                  <ShieldAlert className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Govt 14C Action Registry</h3>
                  <p className="text-[10px] text-slate-400 font-mono tracking-wider font-bold">Ministry of Home Affairs / CFCFRMS Hits</p>
                </div>
              </div>
              <button onClick={() => setIsCfcOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* List */}
            <div className="p-6 space-y-4">
              <div className="text-xs text-slate-650 leading-relaxed border-b border-slate-100 pb-4">
                The Cyber Crime Coordination Centre (I4C) under the Ministry of Home Affairs issues direct freeze and lock directives for bank accounts showing confirmed structuring or cross-channel payment trail splits. The following active accounts are currently hitting these registers:
              </div>

              <div className="space-y-3.5 max-h-64 overflow-y-auto scrollbar-thin">
                
                {/* Account 1 */}
                <div className="p-4 border border-slate-200 rounded-2xl bg-slate-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[9px] bg-red-50 border border-red-150 text-[#DC2626] font-bold px-2 py-0.5 rounded-full font-mono uppercase tracking-wide">
                      CFCFRMS Ref: 1049A
                    </span>
                    <h4 className="text-xs font-bold text-slate-800 mt-2 font-mono">MULE_AC_014C_CFC_07</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Subject: Ananya Dasgupta | Impact: ₹60,000 Splits</p>
                  </div>
                  
                  <button 
                    onClick={() => handleCfcFreeze("MULE_AC_014C_CFC_07")}
                    disabled={cfcLogsLocked.includes("MULE_AC_014C_CFC_07")}
                    className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all shadow-xs shrink-0 ${
                      cfcLogsLocked.includes("MULE_AC_014C_CFC_07")
                        ? 'bg-slate-100 text-slate-400 border border-slate-200/60 cursor-not-allowed'
                        : 'bg-[#DC2626] hover:bg-red-750 text-white shadow-md'
                    }`}
                  >
                    {cfcLogsLocked.includes("MULE_AC_014C_CFC_07") ? 'Frozen ✓' : 'Execute Freeze'}
                  </button>
                </div>

                {/* Account 2 */}
                <div className="p-4 border border-slate-200 rounded-2xl bg-slate-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[9px] bg-red-50 border border-red-150 text-[#DC2626] font-bold px-2 py-0.5 rounded-full font-mono uppercase tracking-wide">
                      CFCFRMS Ref: 8840B
                    </span>
                    <h4 className="text-xs font-bold text-slate-800 mt-2 font-mono">MULE_AC_9082_30A2</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Subject: Rajesh Kumar Sharma | Impact: ₹199,960 splits</p>
                  </div>
                  
                  <button 
                    onClick={() => handleCfcFreeze("MULE_AC_9082_30A2")}
                    disabled={cfcLogsLocked.includes("MULE_AC_9082_30A2")}
                    className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all shadow-xs shrink-0 ${
                      cfcLogsLocked.includes("MULE_AC_9082_30A2")
                        ? 'bg-slate-100 text-slate-400 border border-slate-200/60 cursor-not-allowed'
                        : 'bg-[#DC2626] hover:bg-red-750 text-white shadow-md'
                    }`}
                  >
                    {cfcLogsLocked.includes("MULE_AC_9082_30A2") ? 'Frozen ✓' : 'Execute Freeze'}
                  </button>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/40 flex justify-end">
              <button 
                onClick={() => setIsCfcOpen(false)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-250 text-slate-700 text-xs font-bold rounded-2xl transition-all"
              >
                Close Registry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          6. VERIFIED BASELINE POOL REGISTRY MODAL
          ========================================== */}
      {isBaselineOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 select-none">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setIsBaselineOpen(false)} />
          
          {/* Modal Container */}
          <div className="relative bg-white max-w-xl w-full rounded-3xl shadow-2xl overflow-hidden border border-slate-250 animate-fadeIn font-sans">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-emerald-50/40">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-emerald-55/10 flex items-center justify-center text-[#0F5132] font-black">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Verified Baseline Pool</h3>
                  <p className="text-[10px] text-slate-400 font-mono tracking-wider font-bold">9,082 Normal Ingestion Accounts</p>
                </div>
              </div>
              <button onClick={() => setIsBaselineOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              <p className="text-xs text-slate-650 leading-relaxed">
                The Verified Baseline Pool tracks standard transaction and operational metrics across the banking core. This telemetry establishes the "normal" behavioral profile, acting as contrast inputs for neural anomaly graphs.
              </p>

              {/* Profiles */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Normal Profiling Standard Limits</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { label: 'UPI Split Limit', value: '< ₹12,000', desc: 'Average transaction clusters' },
                    { label: 'Monthly Inbound', value: '₹45,000 avg', desc: 'Standard payroll limits' },
                    { label: 'Geographic Radius', value: '< 15km / Day', desc: 'Consistent device IPs' }
                  ].map((item, idx) => (
                    <div key={idx} className="p-3.5 border border-slate-200 bg-slate-50/50 rounded-2xl">
                      <div className="text-[9px] font-bold text-slate-400 uppercase">{item.label}</div>
                      <div className="text-sm font-black text-slate-800 font-mono mt-1">{item.value}</div>
                      <div className="text-[8.5px] text-slate-450 mt-1">{item.desc}</div>
                    </div>
                  ))}
                </div>

                <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/30 text-xs space-y-2">
                  <div className="flex justify-between items-center text-slate-650">
                    <span className="font-semibold">True Positive Drift Rate</span>
                    <span className="font-mono text-[#0F5132] font-black">&lt; 0.12% monthly</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-650">
                    <span className="font-semibold">Secured Ledger Verification Logs</span>
                    <span className="font-mono text-slate-700 font-black">9,082 verified cores</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/40 flex justify-end">
              <button 
                onClick={() => setIsBaselineOpen(false)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-250 text-slate-700 text-xs font-bold rounded-2xl transition-all"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          7. MULE CAPTURE STATISTICS & HEATMAP MODAL
          ========================================== */}
      {isCaptureStatsOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 select-none">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setIsCaptureStatsOpen(false)} />
          
          {/* Modal Container */}
          <div className="relative bg-white max-w-xl w-full rounded-3xl shadow-2xl overflow-hidden border border-slate-250 animate-fadeIn font-sans">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-emerald-50/40">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-emerald-55/10 flex items-center justify-center text-[#0F5132] font-black">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Confirmed Mule Statistics</h3>
                  <p className="text-[10px] text-slate-400 font-mono tracking-wider font-bold">81 Confirmed Mules Capture Analysis</p>
                </div>
              </div>
              <button onClick={() => setIsCaptureStatsOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              
              {/* Channels */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Channels Splits</h4>
                <div className="space-y-2">
                  {[
                    { label: 'UPI Payout splits (Evading ₹50,000 threshold)', pct: '52%', fill: 'w-[52%] bg-[#0F5132]' },
                    { label: 'IMPS rapid splits (High velocity)', pct: '28%', fill: 'w-[28%] bg-[#419E73]' },
                    { label: 'RTGS corporate shell exits', pct: '12%', fill: 'w-[12%] bg-slate-400' },
                    { label: 'AePS biometric pass-through withdrawals', pct: '8%', fill: 'w-[8%] bg-slate-350' }
                  ].map((item, idx) => (
                    <div key={idx} className="text-xs space-y-1">
                      <div className="flex justify-between font-semibold text-slate-700">
                        <span>{item.label}</span>
                        <span className="font-mono text-slate-800 font-bold">{item.pct}</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${item.fill}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Geographic Hotspots */}
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Regional Geographical Risk Clusters</h4>
                <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-700">
                  <div className="flex items-center justify-between p-3.5 border border-slate-200 rounded-2xl bg-slate-50/50">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <MapPin className="h-4 w-4 text-[#DC2626]" />
                      Jamtara Cluster
                    </span>
                    <span className="font-mono text-[#DC2626] font-extrabold">24% Hit</span>
                  </div>
                  <div className="flex items-center justify-between p-3.5 border border-slate-200 rounded-2xl bg-slate-50/50">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <MapPin className="h-4 w-4 text-[#DC2626]" />
                      Mewat Region
                    </span>
                    <span className="font-mono text-[#DC2626] font-extrabold">18% Hit</span>
                  </div>
                  <div className="flex items-center justify-between p-3.5 border border-slate-200 rounded-2xl bg-slate-50/50">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <MapPin className="h-4 w-4 text-amber-600" />
                      Kolkata Hubs
                    </span>
                    <span className="font-mono text-amber-700 font-extrabold">15% Hit</span>
                  </div>
                  <div className="flex items-center justify-between p-3.5 border border-slate-200 rounded-2xl bg-slate-50/50">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <MapPin className="h-4 w-4 text-slate-450" />
                      NCR Splitters
                    </span>
                    <span className="font-mono text-slate-800 font-extrabold">12% Hit</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/40 flex justify-end">
              <button 
                onClick={() => setIsCaptureStatsOpen(false)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-250 text-slate-700 text-xs font-bold rounded-2xl transition-all"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          8. SESSION SECURED LOCKSCREEN OVERLAY
          ========================================== */}
      {isLockscreenActive && (
        <div className="fixed inset-0 z-[9999] bg-[#020B06]/95 backdrop-blur-md flex items-center justify-center select-none font-sans">
          <div className="relative max-w-sm w-full p-8 text-center bg-white/5 border border-white/10 rounded-3xl shadow-2xl animate-scaleIn">
            
            {/* Lock Circle Graphic */}
            <div className="mx-auto h-16 w-16 bg-[#0F5132]/20 border border-[#419E73]/30 rounded-full flex items-center justify-center text-[#419E73] mb-6 shadow-inner animate-pulse">
              <LockKeyhole className="h-7 w-7" />
            </div>

            <h2 className="text-xl font-bold tracking-tight text-white font-sans">Session locked</h2>
            <p className="text-xs text-emerald-100/50 font-sans mt-2.5 leading-relaxed max-w-xs mx-auto">
              Analyst workspace is paused. The scoring API keeps running in the background; no authentication is configured for this demo build.
            </p>

            {/* Stats during lock */}
            <div className="my-6 p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2 text-xs font-mono text-left max-w-xs mx-auto">
              <div className="flex justify-between items-center">
                <span className="text-white/40 uppercase text-[9px] font-bold">Investigator</span>
                <span className="text-white/80 font-bold">Demo Analyst</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/40 uppercase text-[9px] font-bold">Mode</span>
                <span className="text-emerald-300 font-bold">DEMO · NO AUTH</span>
              </div>
            </div>

            <button
              onClick={() => {
                setIsLockscreenActive(false);
                showToast("Workspace unlocked.", "success");
              }}
              className="w-full py-4 bg-[#0F5132] hover:bg-[#14532D] text-white text-xs font-bold rounded-2xl transition-all shadow-lg shadow-emerald-950/30 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="h-4.5 w-4.5" />
              Resume Workspace
            </button>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') window.location.reload();
              }}
              className="mt-2 w-full py-2.5 bg-transparent hover:bg-white/5 border border-white/10 text-white/70 text-[11px] font-semibold rounded-2xl transition-all"
            >
              Reload session (full reset)
            </button>
          </div>
        </div>
      )}
    </>
  );
}
