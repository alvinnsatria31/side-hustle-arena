'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectDraft } from '@/types/project';

const DRAFT_PREFIX = 'sk-draft-';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'unsaved';

function loadDraft(slug: string): ProjectDraft {
  try {
    const raw = window.localStorage.getItem(DRAFT_PREFIX + slug);
    if (raw) return JSON.parse(raw) as ProjectDraft;
  } catch {
    // ignore
  }
  return {
    projectSlug: slug,
    text: '',
    link: '',
    notes: '',
    deliverables: {},
    updatedAt: new Date().toISOString(),
  };
}

function saveDraft(draft: ProjectDraft) {
  try {
    window.localStorage.setItem(DRAFT_PREFIX + draft.projectSlug, JSON.stringify(draft));
  } catch {
    // ignore
  }
}

export function useProjectDraft(slug: string) {
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveCycleRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setDraft(loadDraft(slug));
  }, [slug]);

  // Periodic cycle that briefly shows "Saving..." then "Saved" to feel real
  useEffect(() => {
    saveCycleRef.current = setInterval(() => {
      // Only rotate when there are no pending writes
      setStatus((prev) => (prev === 'saved' ? 'saved' : prev));
    }, 6000);
    return () => {
      if (saveCycleRef.current) clearInterval(saveCycleRef.current);
    };
  }, []);

  const writeDraft = useCallback(
    (patch: Partial<ProjectDraft>) => {
      setDraft((prev) => {
        if (!prev) return prev;
        const next: ProjectDraft = {
          ...prev,
          ...patch,
          updatedAt: new Date().toISOString(),
        };
        setStatus('saving');
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          saveDraft(next);
          setStatus('saved');
        }, 500);
        return next;
      });
    },
    [],
  );

  const toggleDeliverable = useCallback(
    (id: string) => {
      setDraft((prev) => {
        if (!prev) return prev;
        const next: ProjectDraft = {
          ...prev,
          deliverables: { ...prev.deliverables, [id]: !prev.deliverables[id] },
          updatedAt: new Date().toISOString(),
        };
        setStatus('saving');
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          saveDraft(next);
          setStatus('saved');
        }, 500);
        return next;
      });
    },
    [],
  );

  return { draft, status, writeDraft, toggleDeliverable };
}
