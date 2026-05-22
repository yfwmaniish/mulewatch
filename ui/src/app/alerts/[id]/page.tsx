'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAlerts } from '@/context/AlertContext';

export default function AlertDetailRedirect() {
  const router = useRouter();
  const params = useParams();
  const { setCurrentView, setSelectedAlertId } = useAlerts();
  
  useEffect(() => {
    if (params.id) {
      setSelectedAlertId(params.id as string);
      setCurrentView('triage');
    } else {
      setCurrentView('alerts');
    }
    router.replace('/');
  }, [setCurrentView, setSelectedAlertId, params, router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh] text-xs font-mono text-slate-400">
      Loading Suspect Triage details...
    </div>
  );
}
