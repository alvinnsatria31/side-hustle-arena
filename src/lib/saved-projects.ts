import { useCallback, useEffect, useState } from 'react';

export const SAVED_PROJECTS_KEY = 'sk-saved-projects';
const CHANGE_EVENT = 'sk-saved-projects-change';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Saved slugs in the order they were saved; anything malformed in storage is ignored, not trusted. */
export function readSavedProjects(storage: Pick<Storage, 'getItem'> | null): string[] {
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(SAVED_PROJECTS_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((slug): slug is string => typeof slug === 'string' && slug.length > 0 && slug.length <= 200))];
  } catch {
    return [];
  }
}

/** Save or unsave one project. Null when storage is unavailable, so the caller never claims a save that did not happen. */
export function toggleSavedProject(slug: string, storage: StorageLike | null): { saved: boolean; list: string[] } | null {
  if (!storage) return null;
  try {
    const list = readSavedProjects(storage);
    const next = list.includes(slug) ? list.filter((entry) => entry !== slug) : [...list, slug];
    storage.setItem(SAVED_PROJECTS_KEY, JSON.stringify(next));
    return { saved: next.includes(slug), list: next };
  } catch {
    return null;
  }
}

/** Drop saved slugs that are no longer in the catalog. */
export function pruneSavedProjects(keep: Iterable<string>, storage: StorageLike | null): string[] | null {
  if (!storage) return null;
  try {
    const allowed = new Set(keep);
    const next = readSavedProjects(storage).filter((slug) => allowed.has(slug));
    storage.setItem(SAVED_PROJECTS_KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

/**
 * This browser's saved projects, kept in step between the save button, the
 * catalog filter and other tabs. Saved projects live in localStorage only:
 * they are not tied to an account and do not follow the participant to another
 * device.
 */
export function useSavedProjects() {
  const [saved, setSaved] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setSaved(readSavedProjects(browserStorage()));
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === SAVED_PROJECTS_KEY) sync();
    };
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const toggle = useCallback((slug: string) => {
    const result = toggleSavedProject(slug, browserStorage());
    if (!result) return null;
    setSaved(result.list);
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return result.saved;
  }, []);

  const prune = useCallback((keep: Iterable<string>) => {
    const next = pruneSavedProjects(keep, browserStorage());
    if (!next) return;
    setSaved(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { saved, toggle, prune };
}
