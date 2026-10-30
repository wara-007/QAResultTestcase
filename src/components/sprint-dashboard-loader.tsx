'use client';

import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {readSprintDashboardOverview,type SprintDashboardLoad} from '@/lib/sprint-dashboard-overview';
import type { CurrentUser, Project, Sprint } from '@/lib/types';
import { SprintDashboard } from './sprint-dashboard';

type Props = {groupId:string;groupName:string;sprint:Sprint;projects:Project[];currentUser:CurrentUser|null};
type Loaded = SprintDashboardLoad;

export function SprintDashboardLoader({groupId,groupName,sprint,projects,currentUser}:Props) {
  const params=useSearchParams();
  const view=params.get('view');
  const mode=view==='team'?'team':view==='activity'?'details':view==='history'?'history':'overview';
  const [loaded,setLoaded]=useState<{mode:string;result:Loaded}|null>(null);
  const [progress,setProgress]=useState('กำลังอ่านข้อมูล Sprint');
  const [error,setError]=useState('');
  const [attempt,setAttempt]=useState(0);
  const mounted=useRef(false);
  const request=useRef<{id:string;projects:Project[];attempt:number;promise:Promise<Loaded>}|null>(null);
  useEffect(()=>{
    let active=true;
    mounted.current=true;
    const id=`${groupId}:${sprint.id}:${mode}`;
    if(!request.current || request.current.id!==id || request.current.projects!==projects || request.current.attempt!==attempt) {
      // Reuse the same pending read when React checks effects twice in development.
      const promise:Promise<Loaded>=Promise.resolve().then(async()=>{
        if(mode==='team') {
          const {readSprintTeamData}=await import('@/lib/sprint-team-data');
          return readSprintTeamData(createClient(),groupId,sprint.id,projects,message=>{
            if(mounted.current && request.current?.promise===promise)setProgress(message);
          });
        }
        if(mode!=='details')return readSprintDashboardOverview(createClient(),groupId,sprint.id,projects,mode==='history');
        const {readSprintDashboardData}=await import('@/lib/sprint-dashboard-data');
        const result=await readSprintDashboardData(createClient(),groupId,sprint.id,projects,message=>{
          if(mounted.current && request.current?.promise===promise)setProgress(message);
        });
        return {...result,data:result.data?{...result.data,loadedDetails:true}:undefined};
      });
      request.current={id,projects,attempt,promise};
    }
    const pending=request.current.promise;
    void (async()=>{
      try {
        const result=await pending;
        if(!active)return;
        setError('');
        if(result.error || !result.data) setError(result.error || 'โหลดภาพรวม Sprint ไม่สำเร็จ');
        else setLoaded({mode,result});
      } catch(reason) {
        if(active)setError(reason instanceof Error ? reason.message : 'โหลดภาพรวม Sprint ไม่สำเร็จ');
      }
    })();
    return ()=>{active=false;mounted.current=false;};
  },[groupId,sprint.id,projects,attempt,mode]);
  if(loaded?.mode===mode && loaded.result.data && !error)return <SprintDashboard groupId={groupId} groupName={groupName} sprint={{...sprint,canManage:loaded.result.canManage}} data={loaded.result.data} currentUser={currentUser} sprintHistory={loaded.result.sprintHistory}/>;
  return <main className="groups-screen"><section className="groups-content planning-content">
    <Link href={`/groups/${groupId}/years/${sprint.year}/sprints`}>กลับไป Sprints</Link>
    <div className="panel" style={{padding:'2rem',marginTop:'1rem'}}>
      <h1>{sprint.name}</h1>
      {error ? <div role="alert"><h2>โหลดภาพรวม Sprint ไม่สำเร็จ</h2><p>{error}</p><button type="button" className="secondary-button" onClick={()=>{setLoaded(null);setError('');setProgress('กำลังอ่านข้อมูล Sprint');setAttempt(value=>value+1);}}><RefreshCw size={16}/>ลองอีกครั้ง</button></div>
        : <div role="status" aria-live="polite" aria-busy="true"><LoaderCircle className="spin" size={24} aria-hidden="true"/><h2>กำลังโหลดภาพรวม Sprint</h2><p>{progress}</p></div>}
    </div>
  </section></main>;
}
