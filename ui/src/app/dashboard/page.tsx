'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAlerts } from '@/context/AlertContext';

export default function DashboardRedirect() {
  const router = useRouter();
  const { setCurrentView } = useAlerts();
  
  useEffect(() => {
    setCurrentView('dashboard');
    router.replace('/');
  }, [setCurrentView, router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh] text-xs font-mono text-slate-400">
      Loading Executive Dashboard...
    </div>
  );
}
