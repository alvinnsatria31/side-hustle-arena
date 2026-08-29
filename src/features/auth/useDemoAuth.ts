'use client';

import { useCallback, useEffect, useState } from 'react';

const KEY = 'sk-demo-auth';

export function useDemoAuth() {
  const [isAuthed, setIsAuthed] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    try {
      setIsAuthed(window.localStorage.getItem(KEY) === 'true');
    } catch {
      setIsAuthed(false);
    }
    setHydrated(true);
  }, []);

  const signIn = useCallback(() => {
    try {
      window.localStorage.setItem(KEY, 'true');
    } catch {
      // ignore
    }
    setIsAuthed(true);
  }, []);

  const signOut = useCallback(() => {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
    setIsAuthed(false);
  }, []);

  return { isAuthed, hydrated, signIn, signOut };
}
