"use client";

import { useCallback, useSyncExternalStore } from 'react';
import { parseSprintSort, type SprintSort } from '@/lib/sprint-sort';

const memory = new Map<string, string>();
const eventName = 'qa-sprint-sort-change';
const serverSnapshot = () => 'created-desc' as const;

function read(key: string) {
  if (typeof window === 'undefined') return serverSnapshot();
  try { return parseSprintSort(memory.get(key) ?? window.localStorage.getItem(key)); }
  catch { return parseSprintSort(memory.get(key) ?? null); }
}

function subscribe(callback: () => void) {
  const storageChanged = () => { memory.clear(); callback(); };
  window.addEventListener('storage', storageChanged);
  window.addEventListener(eventName, callback);
  return () => {
    window.removeEventListener('storage', storageChanged);
    window.removeEventListener(eventName, callback);
  };
}

export function useSprintSort(userId: string, groupId: string, year?: number) {
  const key = `qa-sprint-sort:v1:${JSON.stringify([userId, groupId, year ?? null])}`;
  const sort = useSyncExternalStore(subscribe, useCallback(() => read(key), [key]), serverSnapshot);
  const setSort = useCallback((value: SprintSort) => {
    const normalized = parseSprintSort(value);
    memory.set(key, normalized);
    try { window.localStorage.setItem(key, normalized); } catch { /* Keep sorting usable if storage is blocked. */ }
    window.dispatchEvent(new Event(eventName));
  }, [key]);
  return { sort, setSort };
}
