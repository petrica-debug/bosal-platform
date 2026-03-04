'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { Tables } from '@/types/database';

type SupplyChainAlert = Tables<'supply_chain_alerts'>;

export interface UseRealtimeAlertsReturn {
  alerts: SupplyChainAlert[];
  newAlertCount: number;
  resetNewCount: () => void;
}

export function useRealtimeAlerts(orgId: string | null): UseRealtimeAlertsReturn {
  const [alerts, setAlerts] = useState<SupplyChainAlert[]>([]);
  const [newAlertCount, setNewAlertCount] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const supabase = createClient();

  const resetNewCount = useCallback(() => {
    setNewAlertCount(0);
  }, []);

  useEffect(() => {
    if (!orgId) return;

    supabase
      .from('supply_chain_alerts')
      .select('*')
      .eq('organization_id', orgId)
      .eq('is_resolved', false)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setAlerts(data);
      });

    const channel = supabase
      .channel(`alerts:${orgId}`)
      .on<SupplyChainAlert>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'supply_chain_alerts',
          filter: `organization_id=eq.${orgId}`,
        },
        (payload) => {
          setAlerts((prev) => [payload.new, ...prev]);
          setNewAlertCount((prev) => prev + 1);
        },
      )
      .on<SupplyChainAlert>(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'supply_chain_alerts',
          filter: `organization_id=eq.${orgId}`,
        },
        (payload) => {
          setAlerts((prev) =>
            prev.map((a) => (a.id === payload.new.id ? payload.new : a)),
          );
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [orgId, supabase]);

  return { alerts, newAlertCount, resetNewCount };
}
