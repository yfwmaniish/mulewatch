'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { adaptSummary, adaptDetail, parseNumericId } from '@/lib/adapt';
import type { ApiHealth } from '@/lib/api-types';

export interface AccountAlert {
  accountId: string;
  customerName: string;
  kycStatus: 'Verified' | 'Pending' | 'Flagged';
  score: number; // Calibrated probability between 0.0 and 1.0
  riskBand: 'High' | 'Medium' | 'Low' | 'Hard Hit';
  matchedRules: string[];
  timestamp: string;
  assignedSla: string;
  features: Record<string, number | string>;
  shapExplanations: Array<{ feature: string; contribution: number; humanDescription: string }>;
  counterparties: Array<{ id: string; name: string; amount: number; channel: string; timestamp: string }>;
}

export interface StreamEvent {
  id: string;
  timestamp: string;
  accountId: string;
  amount: number;
  channel: 'UPI' | 'IMPS' | 'NEFT' | 'RTGS' | 'AePS' | 'Cards' | 'Branch';
  status: 'PROCESSED' | 'ALERT_TRIGGERED' | 'STEP_UP_SENT' | 'BLOCKED';
  score: number;
}

export interface AnalystFeedItem {
  name: string;
  task: string;
  status: 'Completed' | 'In Progress' | 'Pending Review';
  color: string;
}

export interface ActionLogItem {
  channel: string;
  id: string;
  time: string;
  status: string;
  color: string;
}

export interface SystemSettings {
  decisionBoundary: number; // 0.50 - 0.95
  upiFanoutLimit: number;   // 10 - 100
  dormancyLimitDays: number; // 30 - 365
  autoHoldLeg: boolean;
  forceGov14cLock: boolean;
}

interface AlertContextType {
  alerts: AccountAlert[];
  blockedAccounts: string[];
  pendingRetrainCount: number;
  totalProcessedCount: number;
  trueMulesCount: number;
  streamEvents: StreamEvent[];
  eventsPerSecond: number;

  // Single-account mutations
  markAsFalsePositive: (accountId: string) => Promise<void>;
  executeSystemBlock: (accountId: string) => Promise<void>;
  escalateAccount: (accountId: string, notes?: string) => Promise<void>;

  // Bulk mutations
  bulkMarkFalsePositive: (accountIds: string[]) => Promise<void>;
  bulkEscalate: (accountIds: string[]) => Promise<void>;

  // Selection state for bulk actions
  selectedAlertIds: Set<string>;
  toggleAlertSelection: (id: string) => void;
  selectAllAlerts: () => void;
  clearSelection: () => void;

  // View routing
  currentView: 'dashboard' | 'alerts' | 'triage' | 'registry' | 'network' | 'audit' | 'reports';
  selectedAlertId: string | null;
  setCurrentView: (view: 'dashboard' | 'alerts' | 'triage' | 'registry' | 'network' | 'audit' | 'reports') => void;
  setSelectedAlertId: (id: string | null) => void;

  // Live API health
  apiStatus: 'connecting' | 'online' | 'offline';
  modelVersion: string;
  apiError: string | null;
  refreshAlerts: () => Promise<void>;

  // Analyst identity
  analystId: string;
  setAnalystId: (id: string) => void;

  // Dark mode
  isDarkMode: boolean;
  toggleDarkMode: () => void;

  // Phase 9 States
  isSettingsOpen: boolean;
  setIsSettingsOpen: (val: boolean) => void;
  isHelpOpen: boolean;
  setIsHelpOpen: (val: boolean) => void;
  isModelCardOpen: boolean;
  setIsModelCardOpen: (val: boolean) => void;
  isAddNodalOpen: boolean;
  setIsAddNodalOpen: (val: boolean) => void;
  isCfcOpen: boolean;
  setIsCfcOpen: (val: boolean) => void;
  isBaselineOpen: boolean;
  setIsBaselineOpen: (val: boolean) => void;
  isCaptureStatsOpen: boolean;
  setIsCaptureStatsOpen: (val: boolean) => void;
  isLockscreenActive: boolean;
  setIsLockscreenActive: (val: boolean) => void;

  analysts: AnalystFeedItem[];
  addAnalyst: (analyst: AnalystFeedItem) => void;

  recentLogs: ActionLogItem[];
  addRecentLog: (log: ActionLogItem) => void;

  settings: SystemSettings;
  updateSettings: (newSettings: Partial<SystemSettings>) => void;

  toast: { message: string; type: 'success' | 'warning' } | null;
  showToast: (message: string, type: 'success' | 'warning') => void;
  hideToast: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

// How many accounts to surface in the queue.
const ALERT_QUEUE_LIMIT = 40;

const initialAnalysts: AnalystFeedItem[] = [
  { name: 'Alexandra Deff',         task: 'Pending review', status: 'Completed',      color: 'bg-emerald-50 text-[#0F5132] border border-[#0F5132]/20' },
  { name: 'Edwin Adenike',          task: 'Pending review', status: 'In Progress',    color: 'bg-amber-50 text-amber-700 border border-amber-200' },
  { name: 'Isaac Oluwatemilorun',   task: 'Pending review', status: 'Pending Review', color: 'bg-red-50 text-[#DC2626] border border-[#DC2626]/20' },
  { name: 'David Oshodi',           task: 'Pending review', status: 'In Progress',    color: 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse' },
];

const initialRecentLogs: ActionLogItem[] = [
  { channel: 'SYSTEM', id: 'BOOT', time: '--:--:-- UTC', status: 'Connecting to scoring API…', color: 'text-slate-500 bg-slate-50 border-slate-200' },
];

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alerts, setAlerts] = useState<AccountAlert[]>([]);
  const [alertCache, setAlertCache] = useState<Record<string, AccountAlert>>({});
  const [pendingRetrainCount, setPendingRetrainCount] = useState<number>(0);
  const [totalProcessedCount, setTotalProcessedCount] = useState<number>(0);
  const [trueMulesCount, setTrueMulesCount] = useState<number>(0);
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);
  const [eventsPerSecond, setEventsPerSecond] = useState<number>(45);
  const [currentView, setCurrentView] = useState<AlertContextType['currentView']>('dashboard');
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [selectedAlertIds, setSelectedAlertIds] = useState<Set<string>>(new Set());

  const [apiStatus, setApiStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const [apiError, setApiError] = useState<string | null>(null);
  const [modelVersion, setModelVersion] = useState<string>('');

  // Analyst identity — persisted in localStorage
  const [analystId, setAnalystIdState] = useState<string>('analyst-01');

  // Dark mode — persisted in localStorage
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Phase 9 overlay visibility states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isModelCardOpen, setIsModelCardOpen] = useState(false);
  const [isAddNodalOpen, setIsAddNodalOpen] = useState(false);
  const [isCfcOpen, setIsCfcOpen] = useState(false);
  const [isBaselineOpen, setIsBaselineOpen] = useState(false);
  const [isCaptureStatsOpen, setIsCaptureStatsOpen] = useState(false);
  const [isLockscreenActive, setIsLockscreenActive] = useState(false);

  const [analysts, setAnalysts] = useState<AnalystFeedItem[]>(initialAnalysts);
  const [recentLogs, setRecentLogs] = useState<ActionLogItem[]>(initialRecentLogs);

  const [settings, setSettings] = useState<SystemSettings>({
    decisionBoundary: 0.70,
    upiFanoutLimit: 42,
    dormancyLimitDays: 120,
    autoHoldLeg: true,
    forceGov14cLock: true,
  });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

  // ---- Init from localStorage (client-side only) ----
  useEffect(() => {
    const storedAnalystId = localStorage.getItem('mw_analyst_id');
    if (storedAnalystId) setAnalystIdState(storedAnalystId);

    const storedDarkMode = localStorage.getItem('mw_dark_mode');
    if (storedDarkMode === 'true') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const setAnalystId = (id: string) => {
    setAnalystIdState(id);
    localStorage.setItem('mw_analyst_id', id);
  };

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('mw_dark_mode', String(next));
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  };

  const showToast = (message: string, type: 'success' | 'warning') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };
  const hideToast = () => setToast(null);

  const addAnalyst = (analyst: AnalystFeedItem) => setAnalysts((prev) => [analyst, ...prev]);
  const addRecentLog = (log: ActionLogItem) =>
    setRecentLogs((prev) => [log, ...prev].slice(0, 25));

  const updateSettings = (newSettings: Partial<SystemSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...newSettings };
      if (newSettings.decisionBoundary !== undefined) {
        showToast(`Decision boundary updated to ${Math.round(next.decisionBoundary * 100)}%.`, 'success');
      }
      return next;
    });
  };

  // ---- Selection helpers ----
  const toggleAlertSelection = (id: string) => {
    setSelectedAlertIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllAlerts = () => {
    setSelectedAlertIds(new Set(alerts.map((a) => a.accountId)));
  };

  const clearSelection = () => {
    setSelectedAlertIds(new Set());
  };

  // ---- Real-API ingest ----
  const refreshAlerts = useCallback(async () => {
    try {
      const [health, list] = await Promise.all([
        api.health(),
        api.listAccounts({ pageSize: ALERT_QUEUE_LIMIT, sort: 'score_desc' }),
      ]);
      setApiStatus('online');
      setApiError(null);
      setModelVersion(health.model_version);
      setTotalProcessedCount(health.accounts_loaded);
      setPendingRetrainCount(health.feedback_queue_len);

      const adapted = list.accounts.map(adaptSummary);
      setAlerts(adapted);
      setAlertCache((prev) => {
        const next = { ...prev };
        for (const a of adapted) next[a.accountId] = a;
        return next;
      });
      setTrueMulesCount(adapted.filter((a) => a.riskBand === 'High' || a.riskBand === 'Hard Hit').length);
    } catch (err: any) {
      setApiStatus('offline');
      setApiError(err?.message ?? 'Unknown error');
    }
  }, []);

  useEffect(() => {
    setRecentLogs((prev) =>
      prev.map((log) =>
        log.id === 'BOOT' && log.time.startsWith('--')
          ? { ...log, time: new Date().toLocaleTimeString('en-IN', { hour12: false }) + ' UTC' }
          : log,
      ),
    );

    refreshAlerts();
    const interval = setInterval(() => {
      api.health()
        .then((h: ApiHealth) => {
          setApiStatus('online');
          setModelVersion(h.model_version);
        })
        .catch(() => setApiStatus('offline'));
    }, 5000);
    return () => clearInterval(interval);
  }, [refreshAlerts]);

  // ---- Lazy detail fetch when a row is selected ----
  useEffect(() => {
    if (!selectedAlertId) return;
    const numeric = parseNumericId(selectedAlertId);
    if (numeric == null) return;
    const cached = alertCache[selectedAlertId];
    if (cached && cached.shapExplanations.length > 0) return;

    api.accountDetail(numeric)
      .then((d) => {
        const enriched = adaptDetail(d);
        setAlertCache((prev) => ({ ...prev, [selectedAlertId]: enriched }));
        setAlerts((prev) => prev.map((a) => (a.accountId === selectedAlertId ? enriched : a)));
      })
      .catch(() => { /* swallow; UI shows empty SHAP */ });
  }, [selectedAlertId, alertCache]);

  // ---- Derived: blockedAccounts ----
  const HARD_BLOCK_PREFIXES = ['I4C', 'CFCFRMS', 'FIU'];
  const isHardBlockRule = (r: string) =>
    HARD_BLOCK_PREFIXES.some((p) => r.toUpperCase().startsWith(p));
  const blockedAccounts = React.useMemo(
    () => alerts.filter((a) => a.matchedRules.some(isHardBlockRule)).map((a) => a.accountId),
    [alerts],
  );

  // ---- Decision-boundary re-banding ----
  const calibratedAlerts = React.useMemo(() => {
    return alerts.map((alert) => {
      if (alert.riskBand === 'Hard Hit') return alert;
      const score = alert.score;
      let riskBand: AccountAlert['riskBand'] = 'Low';
      if (score >= settings.decisionBoundary) {
        riskBand = 'High';
      } else if (score >= Math.max(0, settings.decisionBoundary - 0.35)) {
        riskBand = 'Medium';
      }
      return { ...alert, riskBand };
    });
  }, [alerts, settings.decisionBoundary]);

  // ---- Background ambient stream simulator ----
  useEffect(() => {
    const generateRandomEvent = (indexOffset = 0): StreamEvent => {
      const channels: StreamEvent['channel'][] = ['UPI', 'IMPS', 'NEFT', 'RTGS', 'AePS', 'Cards', 'Branch'];
      const channel = channels[Math.floor(Math.random() * channels.length)];
      const score = Math.random();
      let status: StreamEvent['status'] = 'PROCESSED';
      if (score > settings.decisionBoundary) status = 'ALERT_TRIGGERED';
      else if (score > settings.decisionBoundary - 0.15) status = 'STEP_UP_SENT';

      const accountId = `AC_${Math.floor(1000 + Math.random() * 9000)}_${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
      return {
        id: `TX-${Date.now()}-${Math.floor(Math.random() * 10000)}-${indexOffset}`,
        timestamp: new Date(Date.now() - Math.floor(Math.random() * 120) * 1000).toISOString(),
        accountId,
        amount: Math.floor(100 + Math.random() * 250000),
        channel,
        status,
        score,
      };
    };

    const initialEvents = Array.from({ length: 25 }, (_, i) => generateRandomEvent(i)).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    setStreamEvents(initialEvents);

    const interval = setInterval(() => {
      const newEvent = generateRandomEvent();
      setStreamEvents((prev) => [newEvent, ...prev.slice(0, 49)]);
      setEventsPerSecond(Math.floor(40 + Math.random() * 20));
    }, 1500);

    return () => clearInterval(interval);
  }, [settings.decisionBoundary]);

  // ---- Single-account mutations ----
  const markAsFalsePositive = async (displayId: string) => {
    const numeric = parseNumericId(displayId);
    if (numeric == null) return;
    try {
      const res = await api.submitFeedback({
        account_id: numeric,
        verdict: 'false_positive',
        analyst_id: analystId,
      });
      setAlerts((prev) => prev.filter((a) => a.accountId !== displayId));
      setSelectedAlertIds((prev) => { const n = new Set(prev); n.delete(displayId); return n; });
      setPendingRetrainCount(res.queue_position);
      addRecentLog({
        channel: 'API',
        id: displayId.slice(8, 24),
        time: new Date().toLocaleTimeString('en-IN', { hour12: false }) + ' UTC',
        status: `Marked False Positive · retrain queue #${res.queue_position}`,
        color: 'text-[#0F5132] bg-emerald-50 border-emerald-100',
      });
      showToast(`False positive recorded · retrain queue #${res.queue_position}`, 'success');
    } catch (err: any) {
      showToast(`Failed to submit feedback: ${err?.message ?? 'API error'}`, 'warning');
    }
  };

  const escalateAccount = async (displayId: string, notes?: string) => {
    const numeric = parseNumericId(displayId);
    if (numeric == null) return;
    try {
      const res = await api.submitFeedback({
        account_id: numeric,
        verdict: 'escalate',
        notes: notes ?? 'Escalated to Nodal Officer for review.',
        analyst_id: analystId,
      });
      setPendingRetrainCount(res.queue_position);
      addRecentLog({
        channel: 'NODAL',
        id: displayId.slice(8, 24),
        time: new Date().toLocaleTimeString('en-IN', { hour12: false }) + ' UTC',
        status: `Escalated to Nodal Officer · queue #${res.queue_position}`,
        color: 'text-amber-700 bg-amber-50 border-amber-100',
      });
      showToast(`Case escalated to Nodal Officer · queue #${res.queue_position}`, 'success');
    } catch (err: any) {
      showToast(`Failed to escalate: ${err?.message ?? 'API error'}`, 'warning');
    }
  };

  const executeSystemBlock = async (displayId: string) => {
    const numeric = parseNumericId(displayId);
    if (numeric == null) return;
    const ticketRef = `I4C-CFCFRMS-${new Date().getFullYear()}-${String(numeric).padStart(4, '0')}`;
    try {
      await api.submitI4C({ account_id: numeric, ticket_ref: ticketRef });
      const detail = await api.accountDetail(numeric);
      const enriched = adaptDetail(detail);
      setAlertCache((prev) => ({ ...prev, [displayId]: enriched }));
      setAlerts((prev) => prev.map((a) => (a.accountId === displayId ? enriched : a)));
      setTrueMulesCount((prev) => prev + 1);
      addRecentLog({
        channel: 'I4C',
        id: displayId.slice(8, 24),
        time: new Date().toLocaleTimeString('en-IN', { hour12: false }) + ' UTC',
        status: `Account Frozen · ${ticketRef}`,
        color: 'text-red-650 bg-red-50 border-red-100',
      });
      showToast(`Account frozen · I4C ticket ${ticketRef}`, 'success');
    } catch (err: any) {
      showToast(`Failed to issue freeze: ${err?.message ?? 'API error'}`, 'warning');
    }
  };

  // ---- Bulk mutations ----
  const bulkMarkFalsePositive = async (displayIds: string[]) => {
    showToast(`Processing ${displayIds.length} false positive submissions…`, 'success');
    const results = await Promise.allSettled(
      displayIds.map((id) => markAsFalsePositive(id))
    );
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    clearSelection();
    showToast(`${succeeded}/${displayIds.length} accounts marked as false positive.`, 'success');
  };

  const bulkEscalate = async (displayIds: string[]) => {
    showToast(`Escalating ${displayIds.length} accounts to Nodal Officer…`, 'success');
    const results = await Promise.allSettled(
      displayIds.map((id) => escalateAccount(id, 'Bulk escalation by analyst.'))
    );
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    clearSelection();
    showToast(`${succeeded}/${displayIds.length} accounts escalated.`, 'success');
  };

  return (
    <AlertContext.Provider
      value={{
        alerts: calibratedAlerts,
        blockedAccounts,
        pendingRetrainCount,
        totalProcessedCount,
        trueMulesCount,
        streamEvents,
        eventsPerSecond,

        markAsFalsePositive,
        executeSystemBlock,
        escalateAccount,
        bulkMarkFalsePositive,
        bulkEscalate,

        selectedAlertIds,
        toggleAlertSelection,
        selectAllAlerts,
        clearSelection,

        currentView,
        selectedAlertId,
        setCurrentView,
        setSelectedAlertId,

        apiStatus,
        modelVersion,
        apiError,
        refreshAlerts,

        analystId,
        setAnalystId,
        isDarkMode,
        toggleDarkMode,

        isSettingsOpen,
        setIsSettingsOpen,
        isHelpOpen,
        setIsHelpOpen,
        isModelCardOpen,
        setIsModelCardOpen,
        isAddNodalOpen,
        setIsAddNodalOpen,
        isCfcOpen,
        setIsCfcOpen,
        isBaselineOpen,
        setIsBaselineOpen,
        isCaptureStatsOpen,
        setIsCaptureStatsOpen,
        isLockscreenActive,
        setIsLockscreenActive,

        analysts,
        addAnalyst,

        recentLogs,
        addRecentLog,

        settings,
        updateSettings,

        toast,
        showToast,
        hideToast,
      }}
    >
      {children}
    </AlertContext.Provider>
  );
};

export const useAlerts = () => {
  const context = useContext(AlertContext);
  if (context === undefined) {
    throw new Error('useAlerts must be used within an AlertProvider');
  }
  return context;
};
