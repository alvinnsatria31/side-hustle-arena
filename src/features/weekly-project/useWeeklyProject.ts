'use client';

import { useCallback, useEffect, useState } from 'react';

const SELECTION_KEY = 'sk-weekly-selection';
const STAGE_KEY = 'sk-weekly-stage';
const SUBMITTED_KEY = 'sk-weekly-submitted';

export type ProjectStage = 'selected' | 'in_progress' | 'submitted' | 'result';

export function useWeeklyProject() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [stage, setStage] = useState<ProjectStage | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setSelectedSlug(window.localStorage.getItem(SELECTION_KEY));
      const s = window.localStorage.getItem(STAGE_KEY) as ProjectStage | null;
      if (s) setStage(s);
      setSubmittedAt(window.localStorage.getItem(SUBMITTED_KEY));
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  const selectProject = useCallback((slug: string) => {
    try {
      window.localStorage.setItem(SELECTION_KEY, slug);
      window.localStorage.setItem(STAGE_KEY, 'selected');
    } catch {
      // ignore
    }
    setSelectedSlug(slug);
    setStage('selected');
  }, []);

  const markInProgress = useCallback(() => {
    try {
      window.localStorage.setItem(STAGE_KEY, 'in_progress');
    } catch {
      // ignore
    }
    setStage('in_progress');
  }, []);

  const submitProject = useCallback(() => {
    const now = new Date().toISOString();
    try {
      window.localStorage.setItem(STAGE_KEY, 'submitted');
      window.localStorage.setItem(SUBMITTED_KEY, now);
    } catch {
      // ignore
    }
    setStage('submitted');
    setSubmittedAt(now);
  }, []);

  const showResult = useCallback(() => {
    try {
      window.localStorage.setItem(STAGE_KEY, 'result');
    } catch {
      // ignore
    }
    setStage('result');
  }, []);

  const resetAll = useCallback(() => {
    try {
      window.localStorage.removeItem(SELECTION_KEY);
      window.localStorage.removeItem(STAGE_KEY);
      window.localStorage.removeItem(SUBMITTED_KEY);
    } catch {
      // ignore
    }
    setSelectedSlug(null);
    setStage(null);
    setSubmittedAt(null);
  }, []);

  return {
    hydrated,
    selectedSlug,
    stage,
    submittedAt,
    selectProject,
    markInProgress,
    submitProject,
    showResult,
    resetAll,
  };
}
