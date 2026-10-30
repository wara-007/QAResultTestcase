import type { PlanningTeamMember, TestStatus } from './types';

export type PersonalResult = {id:string;testerId?:string;testerName:string;status:string;source:'web'|'sheets';sourceSheet:string;recordedAt:string;order:number;originSprintId?:string;inferred:boolean;detailPath?:string};
export type PersonalCase = {projectId:string;projectName:string;currentSprintId:string;caseId:string;caseName:string;sourceRowKey:string;detailPath:string;assignedUserIds:string[];results:PersonalResult[];snapshotAt?:string;baselineResultIds?:string[];carriedIn?:boolean};
export type PerformanceFilters = {projectId?:string;testerKey?:string;source?:'web'|'sheets'};
export type PersonalEntry = {key:string;projectId:string;projectName:string;caseId:string;caseName:string;sourceRowKey:string;detailPath:string;status:TestStatus;source:'web'|'sheets'|'pending';inferred:boolean;recordedAt:string};
export type PersonalPerformanceRow = {key:string;name:string;email:string;unresolved:boolean;projects:number;assigned:number;assignedEntries:PersonalEntry[];tested:number;pass:number;failed:number;inProgress:number;skip:number;notStart:number;entries:PersonalEntry[]};
export type PersonalPerformanceInput = {sprintId:string;members:PlanningTeamMember[];cases:PersonalCase[];filters?:PerformanceFilters;basis?:'test-cases'};

const normalized = (value:string) => value.trim().toLocaleLowerCase().replace(/\s+/g,' ');
function statusOf(value:string): TestStatus {
  const key=normalized(value).replace(/[\s_-]/g,'');
  return ({pass:'Pass',passed:'Pass',fail:'Failed',failed:'Failed',inprogress:'In Progress',skip:'Skip',skipped:'Skip'} as Record<string,TestStatus>)[key] ?? 'Not Start';
}
function tester(result:PersonalResult,members:PlanningTeamMember[]) {
  const name=result.testerName.trim();
  const byId=result.testerId && members.find(m=>m.userId===result.testerId);
  const matches=members.filter(m=>normalized(m.email)===normalized(name));
  const names=members.filter(m=>normalized(m.name)===normalized(name));
  const match=byId || (name && matches.length===1 ? matches[0] : name && names.length===1 ? names[0] : undefined);
  if(match) return {key:match.userId,name:match.name,email:match.email,unresolved:false};
  if(result.testerId) return {key:result.testerId,name:name || 'อดีตผู้ทดสอบ',email:'',unresolved:false};
  return {key:name ? `name:${normalized(name)}` : 'unknown',name:name || 'ไม่ระบุผู้ทดสอบ',email:'',unresolved:true};
}
function newer(a:PersonalResult,b:PersonalResult) {
  const left=Date.parse(a.recordedAt),right=Date.parse(b.recordedAt);
  return Number.isFinite(left) && Number.isFinite(right) && left!==right ? left>right : a.order>b.order;
}

export function buildPersonalPerformance(input: PersonalPerformanceInput): PersonalPerformanceRow[] {
  const rows=new Map<string,PersonalPerformanceRow>();
  const filters=input.filters ?? {};
  function ensure(person:ReturnType<typeof tester>) {
    let current=rows.get(person.key);
    if(!current) {current={...person,projects:0,assigned:0,assignedEntries:[],tested:0,pass:0,failed:0,inProgress:0,skip:0,notStart:0,entries:[]};rows.set(person.key,current);}
    return current;
  }
  function add(person:ReturnType<typeof tester>,entry:PersonalEntry) {
    if(filters.testerKey && filters.testerKey!==person.key) return;
    if(filters.source && entry.source!==filters.source) return;
    const current=ensure(person);
    const existing=current.entries.findIndex(e=>e.key===entry.key);
    if(existing>=0) current.entries[existing]=entry; else current.entries.push(entry);
  }
  for(const item of input.cases) {
    if(filters.projectId && item.projectId!==filters.projectId) continue;
    const key=JSON.stringify([item.projectId,item.caseId,item.sourceRowKey]);
    const entry=(status:TestStatus,source:PersonalEntry['source'],inferred=false,recordedAt=''):PersonalEntry=>({key,projectId:item.projectId,projectName:item.projectName,caseId:item.caseId,caseName:item.caseName,sourceRowKey:item.sourceRowKey,detailPath:item.detailPath,status,source,inferred,recordedAt});
    if(item.currentSprintId===input.sprintId) for(const userId of new Set(item.assignedUserIds)) {
      if(filters.testerKey && filters.testerKey!==userId) continue;
      const member=input.members.find(m=>m.userId===userId);
      const assigned=ensure({key:userId,name:member?.name ?? 'อดีตผู้รับผิดชอบ',email:member?.email ?? '',unresolved:false});
      if(!assigned.assignedEntries.some(e=>e.key===key)) assigned.assignedEntries.push(entry('Not Start','pending'));
    }
    const latest=new Map<string,{person:ReturnType<typeof tester>;result:PersonalResult}>();
    for(const result of item.results) {
      const applicable=result.inferred || !result.originSprintId ? item.currentSprintId===input.sprintId : result.originSprintId===input.sprintId;
      if(!applicable) continue;
      const person=tester(result,input.members),previous=latest.get(person.key);
      if(!previous || newer(result,previous.result)) latest.set(person.key,{person,result});
    }
    if(input.basis==='test-cases') {
      // The register owns one current tester per case; detail-sheet Results
      // must never add additional people to this reporting basis.
      if(!latest.size) add({key:'unassigned',name:'ยังไม่ระบุผู้รับผิดชอบ',email:'',unresolved:false},entry('Not Start','pending'));
      for(const {person,result} of latest.values()) {
        const status=statusOf(result.status);
        if(person.key==='unknown' && status==='Not Start') {
          add({key:'unassigned',name:'ยังไม่ระบุผู้รับผิดชอบ',email:'',unresolved:false},entry('Not Start','pending'));
          continue;
        }
        if(person.key!=='unknown' && (!filters.testerKey || filters.testerKey===person.key)) {
          const assigned=ensure(person);
          if(!assigned.assignedEntries.some(item=>item.key===key))assigned.assignedEntries.push(entry('Not Start','pending'));
        }
        add(person,entry(status,status==='Not Start'?'pending':result.source,result.inferred,result.recordedAt));
      }
      continue;
    }
    const started=new Set<string>();
    for(const [personKey,{person,result}] of latest) {
      const status=statusOf(result.status);
      if(status==='Not Start') continue;
      started.add(personKey);add(person,{...entry(status,result.source,result.inferred,result.recordedAt),detailPath:result.detailPath ?? item.detailPath});
    }
    if(item.currentSprintId!==input.sprintId) continue;
    if(item.carriedIn) continue;
    // A recorded Skip is not pending work. An assignment is not proof of who
    // skipped the case when the source has no EXECUTED BY.
    if ([...latest.values()].some(({ person, result }) => person.key === 'unknown' && statusOf(result.status) === 'Skip')) continue;
    for(const userId of new Set(item.assignedUserIds)) if(!started.has(userId)) {
      const member=input.members.find(m=>m.userId===userId);
      add({key:userId,name:member?.name ?? 'อดีตผู้รับผิดชอบ',email:member?.email ?? '',unresolved:false},entry('Not Start','pending'));
    }
    if(!started.size && !item.assignedUserIds.length) add({key:'unassigned',name:'ยังไม่ระบุผู้รับผิดชอบ',email:'',unresolved:false},entry('Not Start','pending'));
  }
  for(const row of rows.values()) {
    row.assigned=row.assignedEntries.length;
    row.projects=new Set([...row.entries,...row.assignedEntries].map(e=>e.projectId)).size;
    for(const entry of row.entries) row[({'Pass':'pass','Failed':'failed','In Progress':'inProgress','Skip':'skip','Not Start':'notStart'} as const)[entry.status]]++;
    row.tested=row.pass+row.failed;
  }
  return [...rows.values()].filter(row=>!filters.source || row.entries.length>0).sort((a,b)=>a.key==='unassigned' ? 1 : b.key==='unassigned' ? -1 : b.tested-a.tested || a.name.localeCompare(b.name));
}

export function buildSprintResultActivity(input:PersonalPerformanceInput) {
  const activity=new Map<string,{key:string;resultId:string;testerName:string;projectName:string;caseIds:string[];detailPath:string;status:TestStatus;recordedAt:string;source:'web'|'sheets'}>();
  for(const item of input.cases) for(const result of item.results) {
    const applicable=result.inferred || !result.originSprintId ? item.currentSprintId===input.sprintId : result.originSprintId===input.sprintId;
    if(!applicable || !Number.isFinite(Date.parse(result.recordedAt))) continue;
    const key=JSON.stringify([item.projectId,result.source,result.sourceSheet,result.id]);
    const existing=activity.get(key);
    if(existing) {if(!existing.caseIds.includes(item.caseId)) existing.caseIds.push(item.caseId);continue;}
    activity.set(key,{key,resultId:result.id,testerName:tester(result,input.members).name,projectName:item.projectName,caseIds:[item.caseId],detailPath:result.detailPath ?? item.detailPath,status:statusOf(result.status),recordedAt:result.recordedAt,source:result.source});
  }
  return [...activity.values()].sort((a,b)=>Date.parse(b.recordedAt)-Date.parse(a.recordedAt) || a.key.localeCompare(b.key));
}
