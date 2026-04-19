import { useEffect, DependencyList } from 'react';
import { supabase } from '../lib/supabase';

type EventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface Options {
  event?: EventType;
  filter?: string;
}

export function useRealtime(
  table: string,
  callback: (payload: any) => void,
  { event = '*', filter }: Options = {},
  deps: DependencyList = []
) {
  useEffect(() => {
    const channelName = `realtime-${table}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as any,
        { event, schema: 'public', table, filter },
        callback
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
