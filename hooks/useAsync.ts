import { useState, useEffect, useCallback, useRef, DependencyList } from 'react';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useAsync<T>(
  fn: () => Promise<T>,
  deps: DependencyList = []
): AsyncState<T> & { refetch: () => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const mountedRef = useRef(true);

  const execute = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const result = await fn();
      if (mountedRef.current) {
        setState({ data: result, loading: false, error: null });
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setState({ data: null, loading: false, error: err?.message ?? 'Something went wrong' });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    execute();
    return () => {
      mountedRef.current = false;
    };
  }, [execute]);

  return { ...state, refetch: execute };
}
