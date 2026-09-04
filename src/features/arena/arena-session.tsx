'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ArenaApiError, getCurrentEnrollment, type ArenaEnrollment } from '@/lib/arena-client';

/**
 * Untuk apa: pengganti `useDemo()` khusus Arena yang terautentikasi.
 *
 * - `DemoProvider` = state palsu di localStorage (bisa diubah user di DevTools).
 * - `ArenaSessionProvider` = baca enrollment asli dari server via cookie session.
 *
 * Cara pakai (nanti per page, satu vertical slice per commit):
 * ```tsx
 * // di server component /app/arena/page wrapper:
 * <ArenaSessionProvider initialEnrollment={serverEnrollment}>
 *   <ArenaHomeClient ... />
 * </ArenaSessionProvider>
 * ```
 * Jangan mount provider ini di `src/app/layout.tsx` sebelum semua konsumen
 * Arena pindah — biarkan `DemoProvider` tetap hidup untuk CV/jobs sementara.
 */

interface ArenaSessionValue {
  enrollment: ArenaEnrollment | null;
  isLoading: boolean;
  error: ArenaApiError | null;
  refresh: () => Promise<void>;
}

const ArenaSessionContext = createContext<ArenaSessionValue | null>(null);

export function ArenaSessionProvider({
  children,
  initialEnrollment = null,
}: {
  children: ReactNode;
  initialEnrollment?: ArenaEnrollment | null;
}) {
  const [enrollment, setEnrollment] = useState<ArenaEnrollment | null>(initialEnrollment);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ArenaApiError | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setEnrollment(await getCurrentEnrollment());
    } catch (err) {
      // 401 = belum login → enrollment null, bukan error fatal.
      if (err instanceof ArenaApiError && err.status === 401) {
        setEnrollment(null);
        setError(null);
      } else {
        setError(err instanceof ArenaApiError ? err : new ArenaApiError('INTERNAL_ERROR', 'Gagal memuat enrollment.', 500));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo<ArenaSessionValue>(
    () => ({ enrollment, isLoading, error, refresh }),
    [enrollment, isLoading, error, refresh],
  );

  return <ArenaSessionContext.Provider value={value}>{children}</ArenaSessionContext.Provider>;
}

export function useArenaSession(): ArenaSessionValue {
  const ctx = useContext(ArenaSessionContext);
  if (!ctx) throw new Error('useArenaSession must be used within ArenaSessionProvider');
  return ctx;
}
