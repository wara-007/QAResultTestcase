"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { LoaderCircle, Search, X } from 'lucide-react';
import { nextSearchOption, type ProjectSearchHit } from '@/lib/global-project-search';

export function GlobalProjectSearch() {
  const router=useRouter();
  const id=useId();
  const root=useRef<HTMLDivElement>(null);
  const [query,setQuery]=useState('');
  const [open,setOpen]=useState(false);
  const [active,setActive]=useState(-1);
  const [state,setState]=useState<{query:string;projects:ProjectSearchHit[];hasMore:boolean;error:string}>({query:'',projects:[],hasMore:false,error:''});
  const trimmed=query.trim();
  const loading=open && trimmed.length>=2 && state.query!==trimmed;
  const projects=state.query===trimmed ? state.projects : [];

  useEffect(()=>{
    if(open && active>=0) root.current?.querySelectorAll('[role="option"]')[active]?.scrollIntoView({block:'nearest'});
  },[open,active,projects.length]);

  useEffect(()=>{
    if(!open || trimmed.length<2) return;
    const controller=new AbortController();
    const timer=setTimeout(async()=>{
      try {
        const response=await fetch(`/api/projects/search?q=${encodeURIComponent(trimmed)}`,{signal:controller.signal,cache:'no-store'});
        const data=await response.json();
        if(!response.ok) throw new Error(data.error || 'ค้นหาไม่สำเร็จ');
        if(!controller.signal.aborted) setState({query:trimmed,projects:data.projects,hasMore:data.hasMore,error:''});
      } catch(reason) {
        if(!controller.signal.aborted) setState({query:trimmed,projects:[],hasMore:false,error:reason instanceof Error ? reason.message : 'ค้นหาไม่สำเร็จ'});
      }
    },250);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[open,trimmed]);

  useEffect(()=>{
    function outside(event:PointerEvent) {
      if(event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown',outside);
    return ()=>document.removeEventListener('pointerdown',outside);
  },[]);

  return <div className="global-project-search" ref={root} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget)) setOpen(false);}}>
    <div className="global-search-input"><Search size={17} aria-hidden="true"/><input
      aria-label="ค้นหา Project ทุกกลุ่ม" placeholder="ค้นหา Project ทุกกลุ่ม…" maxLength={120}
      role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-results`}
      aria-activedescendant={open && active>=0 && projects[active] ? `${id}-${active}` : undefined}
      value={query} onFocus={()=>setOpen(true)} onChange={event=>{setQuery(event.target.value);setOpen(true);setActive(-1);}}
      onKeyDown={event=>{
        if(event.key==='Escape') {setOpen(false);setActive(-1);}
        if(event.key==='ArrowDown' || event.key==='ArrowUp') {
          event.preventDefault();setOpen(true);
          setActive(previous=>nextSearchOption(previous,projects.length,event.key==='ArrowDown'?'down':'up'));
        }
        if(event.key==='Enter' && open && active>=0 && projects[active]) {
          event.preventDefault();setOpen(false);router.push(projects[active].href);
        }
      }}/>{query && <button type="button" aria-label="ล้างคำค้นหา" onClick={()=>{setQuery('');setActive(-1);root.current?.querySelector('input')?.focus();}}><X size={15}/></button>}</div>
    {open && <div className="global-search-dropdown">
      <p className="global-search-hint" role="status">{trimmed.length<2 ? 'พิมพ์ชื่อ Project อย่างน้อย 2 ตัวอักษร · ค้นหาทุกกลุ่ม/ปี/Sprint' : loading ? <><LoaderCircle size={15} className="spin"/>กำลังค้นหา…</> : state.error || (projects.length ? `${projects.length} Projects${state.hasMore?' · มีรายการเพิ่มเติม กรุณาระบุคำค้นให้เจาะจงขึ้น':''}` : 'ไม่พบ Project ที่ตรงกับคำค้น')}</p>
      <div id={`${id}-results`} role="listbox" aria-label="ผลการค้นหา Project">{projects.map((project,index)=><Link
        key={project.id} id={`${id}-${index}`} href={project.href} prefetch={false} role="option" aria-selected={active===index}
        className={active===index?'active':''} onClick={()=>{setOpen(false);setQuery('');}} onMouseEnter={()=>setActive(index)}>
        <strong>{project.name}</strong><span>{[project.groupName,project.year && `ปี ${project.year}`,project.sprintName,project.environment].filter(Boolean).join(' · ')}</span>
      </Link>)}</div>
    </div>}
  </div>;
}
