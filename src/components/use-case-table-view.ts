"use client";
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { caseTableStorageKey, parseCaseTableView, type CaseTableView } from '@/lib/case-table-view';

const memory=new Map<string,string>();
const eventName='qa-case-table-view-change';
function read(key:string) {
  if(typeof window==='undefined') return '';
  try {return memory.get(key) ?? window.localStorage.getItem(key) ?? '';}
  catch {return memory.get(key) ?? '';}
}
const serverSnapshot=()=>'';
function subscribe(callback:()=>void) {
  const storageChanged=()=>{memory.clear();callback();};
  window.addEventListener('storage',storageChanged);
  window.addEventListener(eventName,callback);
  return ()=>{window.removeEventListener('storage',storageChanged);window.removeEventListener(eventName,callback);};
}

export function useCaseTableView(userId:string,projectId:string) {
  const key=caseTableStorageKey(userId,projectId);
  const snapshot=useSyncExternalStore(subscribe,useCallback(()=>read(key),[key]),serverSnapshot);
  const view=useMemo(()=>parseCaseTableView(snapshot),[snapshot]);
  const update=useCallback((changes:Partial<CaseTableView>)=>{
    if(!userId || !projectId) return;
    const serialized=JSON.stringify({...parseCaseTableView(read(key)),...changes,version:1});
    memory.set(key,serialized);
    try {window.localStorage.setItem(key,serialized);} catch { /* Still usable when browser storage is blocked. */ }
    window.dispatchEvent(new Event(eventName));
  },[key,userId,projectId]);
  return {view,update};
}
