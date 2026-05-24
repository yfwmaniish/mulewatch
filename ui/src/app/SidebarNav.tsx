'use client';

import React from 'react';
import { useAlerts } from '@/context/AlertContext';
import { 
  LayoutDashboard, 
  ShieldAlert, 
  Settings, 
  HelpCircle, 
  LogOut,
  Shield,
  Cpu,
  Users,
  FileDown,
  FileText,
  BarChart2
} from 'lucide-react';

export default function SidebarNav() {
  const { 
    currentView, 
    setCurrentView, 
    alerts,
    setIsSettingsOpen,
    setIsHelpOpen,
    setIsModelCardOpen,
    setIsLockscreenActive,
    analystId
  } = useAlerts();

  const handleNavClick = (view: 'dashboard' | 'alerts' | 'registry' | 'network' | 'audit' | 'reports') => {
    setCurrentView(view);
  };

  const activeClass = (view: 'dashboard' | 'alerts' | 'registry' | 'network' | 'audit' | 'reports') => {
    return currentView === view;
  };

  const menuItems = [
    {
      id: 'dashboard' as const,
      name: 'Dashboard',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'alerts' as const,
      name: 'Alert Queue',
      icon: ShieldAlert,
      badge: alerts.length > 0 ? (alerts.length > 99 ? "99+" : String(alerts.length)) : null,
      badgeColor: 'bg-[#DC2626] text-white font-mono font-bold text-[9px] px-2 py-0.5 rounded-full'
    },
    {
      id: 'registry' as const,
      name: 'Model Registry',
      icon: Cpu,
      badge: null
    },
    {
      id: 'network' as const,
      name: 'Network Topology',
      icon: Users,
      badge: null
    },
    {
      id: 'audit' as const,
      name: 'Audit Log',
      icon: FileText,
      badge: null
    },
    {
      id: 'reports' as const,
      name: 'Reports',
      icon: BarChart2,
      badge: null
    }
  ];

  const generalItems = [
    {
      name: 'Settings',
      icon: Settings
    },
    {
      name: 'Compliance Help',
      icon: HelpCircle,
      sub: 'RBI FREE-AI'
    },
    {
      name: 'Logout',
      icon: LogOut
    }
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col h-screen sticky top-0 shrink-0 select-none font-sans">
      <div className="flex-1 overflow-y-auto p-6 pb-2 no-scrollbar">
        {/* Logo Branding Section - Replicating Donezo Clover styled Shield */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="h-9 w-9 rounded-xl bg-[#0F5132]/10 flex items-center justify-center text-[#0F5132] font-black shadow-inner shadow-emerald-950/5 hover:scale-105 active:scale-95 transition-all">
            <Shield className="h-5 w-5 text-[#0F5132] fill-[#419E73]/20" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-800 font-sans leading-none flex items-center gap-1">
              MuleWatch
            </h1>
            <p className="text-[9px] font-mono tracking-widest text-slate-400 font-bold mt-1 uppercase">AML Compliance Core</p>
          </div>
        </div>

        {/* Menu Section Label */}
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-3">
          Menu
        </div>

        {/* Navigation Routes */}
        <nav className="space-y-1 mb-8">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = activeClass(item.id);
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl transition-all text-xs font-semibold relative ${
                  active
                    ? 'bg-slate-50 text-slate-800 font-bold'
                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50/50'
                }`}
              >
                {/* Donezo Active Indicator - Left Green Vertical Pill Bar */}
                {active && (
                  <span className="absolute left-0 top-1/4 bottom-1/4 w-1.5 rounded-r-md bg-[#0F5132] shadow-sm animate-pulse-slow" />
                )}

                <div className="flex items-center gap-3.5 pl-1.5">
                  <Icon className={`h-4.5 w-4.5 ${active ? 'text-[#0F5132]' : 'text-slate-400'}`} />
                  <span className={active ? 'text-[#0F5132]' : ''}>{item.name}</span>
                </div>
                {item.badge !== null && (
                  <span className={item.badgeColor}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* General Section Label */}
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-3">
          General
        </div>

        {/* Lower/General Items */}
        <nav className="space-y-1">
          {generalItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                onClick={() => {
                  if (item.name === 'Compliance Help') {
                    setIsHelpOpen(true);
                  } else if (item.name === 'Settings') {
                    setIsSettingsOpen(true);
                  } else if (item.name === 'Logout') {
                    setIsLockscreenActive(true);
                  }
                }}
                className="w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-slate-400 hover:text-slate-700 hover:bg-slate-50/50 transition-all text-xs font-semibold"
              >
                <div className="flex items-center gap-3.5 pl-1.5">
                  <Icon className="h-4.5 w-4.5 text-slate-400" />
                  <span>{item.name}</span>
                </div>
                {item.sub && (
                  <span className="text-[8px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-500 font-mono shadow-sm">
                    {item.sub}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-6 pt-2 shrink-0">
        {/* Donezo Style Bottom Promotion Card -> "Download Model Card PDF" */}
        <div className="relative overflow-hidden rounded-3xl bg-[#0F5132] p-5 text-white shadow-xl shadow-emerald-950/20 hover:scale-[1.01] transition-transform select-none group">
          {/* Abstract background green gradients */}
          <div className="absolute inset-0 bg-gradient-to-tr from-[#14532D] to-[#419E73] opacity-90" />
          <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-white/10 blur-xl group-hover:scale-110 transition-transform" />
          
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center mb-3 shrink-0">
              <FileDown className="h-4 w-4 text-emerald-100 shrink-0" />
            </div>
            <h4 className="text-[11px] font-bold tracking-wide uppercase text-emerald-100">Audit Framework</h4>
            <p className="text-[10px] text-white/80 font-normal font-sans mt-1 mb-4 leading-snug">
              Download our verified Compliance Model Card PDF.
            </p>
            
            <button 
              onClick={() => setIsModelCardOpen(true)}
              className="w-full py-2 bg-white/15 hover:bg-white/20 active:bg-white/10 border border-white/20 rounded-2xl text-[10px] font-bold text-white tracking-wide transition-all shadow-sm shrink-0"
            >
              Download Card
            </button>
          </div>
        </div>

        {/* Analyst Info */}
        <div className="mt-4 flex items-center gap-3 px-2 py-2">
          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs uppercase dark:bg-slate-800 dark:text-slate-400 shrink-0">
            {analystId.slice(0, 2)}
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {analystId}
            </p>
            <p className="text-[10px] text-slate-400">
              Active Session
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
