import { displayTestCaseId } from "./register-case-identity";
import { TEST_STATUSES, type TestCase, type TestStatus } from './types';
import { stepHeaderKey } from './step-testcases';

export const CASE_ADVANCED_FILTERS_ENABLED=false;

export type CaseColumn={key:string;label:string;field?:keyof TestCase;column?:number;sourceLabel?:string};
export type CaseTableFilter={column:string;operator:'contains'|'equals'|'empty'|'not-empty';value:string};
export type CaseTableView={version?:1;query:string;status:TestStatus|'All';selected:string[]|null;filters:CaseTableFilter[]};
const normalize=(value:string)=>value.trim().toLocaleLowerCase().replace(/\s+/g,' ');
const sourceKey=(column:number,label:string)=>`source:${column}:${normalize(label)}`;
export function caseRegisterIdLabel(caseId:string,sheetAlias:string,associatedSheetNames:string[]):string {
  const resultTab=sheetAlias || associatedSheetNames.find(name=>normalize(name)===normalize(caseId));
  return resultTab ? `${caseId} (${resultTab})` : caseId;
}
const fallbackFields=[['name','Test Case Name'],['scenario','Test Scenario'],['condition','Condition'],['steps','Test Step Description'],['expected','Expected Result'],['status','Status'],['platform','Platform'],['device','Device'],['testData','Test data'],['appVersion','App version'],['environment','Environment'],['resultReference','Ref (Result Testing)'],['executedBy','ผู้ทดสอบ'],['executedDate','EXECUTED Date'],['executedTime','EXECUTED Time'],['remark','Remark']] as const;

export function collectCaseColumns(cases:TestCase[]):CaseColumn[] {
  const columns=new Map<string,CaseColumn>([['id',{key:'id',label:'Test Case ID',field:'id'}]]);
  for(const item of cases) {
    for(const source of item.sourceFields ?? []) {
      if(source.field==='id') {columns.set('id',{key:'id',label:source.label,field:'id'});continue;}
      const key=sourceKey(source.column,source.label);
      if(!columns.has(key)) columns.set(key,{key,label:source.label,field:source.field,column:source.column,sourceLabel:source.label});
    }
    for(const custom of item.customFields ?? []) {
      if(custom.source!=='testcase') continue;
      const key=sourceKey(custom.column,custom.label);
      if(!columns.has(key)) columns.set(key,{key,label:custom.label,column:custom.column,sourceLabel:custom.label});
    }
    for(const step of item.stepDefinitions ?? []) for(const source of step.sourceFields ?? []) {
      if(item.sourceFields?.some(field=>field.column===source.column && field.field==='id')) continue;
      const key=sourceKey(source.column,source.label);
      const field=source.mapped && stepHeaderKey(source.label)==='status' ? 'status' : undefined;
      if(!columns.has(key)) columns.set(key,{key,label:source.label,column:source.column,sourceLabel:source.label,field});
      else if(field) columns.set(key,{...columns.get(key)!,field});
    }
  }
  for(const [field,label] of fallbackFields) {
    if(![...columns.values()].some(c=>c.field===field) && (field==='status' || field==='name' || cases.some(item=>typeof item[field]==='string' && item[field].trim()))) columns.set(field,{key:field,label,field});
  }
  return [...columns.values()];
}

export function caseColumnValue(item:TestCase,column:CaseColumn):string {
  if(column.field==='id') return displayTestCaseId(item);
  if(column.field==='status') return item.status;
  if(column.column!==undefined) {
    const source=item.sourceFields?.find(field=>field.column===column.column && normalize(field.label)===normalize(column.sourceLabel ?? column.label));
    const custom=item.customFields?.find(field=>field.source==='testcase' && field.column===column.column && normalize(field.label)===normalize(column.sourceLabel ?? column.label));
    if(!source && !custom) {
      const values=(item.stepDefinitions ?? []).flatMap(step=>{
        const cell=step.sourceFields?.find(field=>field.column===column.column && normalize(field.label)===normalize(column.sourceLabel ?? column.label));
        return cell?.value.trim() ? [{name:step.name,value:cell.value}] : [];
      });
      // Shared metadata (e.g. Spint/Env) is repeated on every Step in the source.
      // Only annotate values with Step names when those values actually differ.
      const distinct=[...new Set(values.map(value=>value.value.trim()))];
      if(distinct.length<=1) return distinct[0] ?? '';
      return values.map(value=>value.name.trim()===value.value.trim()?value.value:`${value.name}: ${value.value}`).join('\n');
    }
    const field=source?.field;
    if(field && typeof item[field]==='string') return item[field] as string;
    return custom?.value ?? source?.value ?? '';
  }
  return column.field && typeof item[column.field]==='string' ? item[column.field] as string : '';
}

export function visibleCaseColumns(columns:CaseColumn[],selection:string[]|null):CaseColumn[] {
  const defaults=['id',...['status','scenario','device','executedBy'].flatMap(field=>columns.find(c=>c.field===field)?.key ?? [])];
  const byKey=new Map(columns.map(c=>[c.key,c]));
  return [...new Set(['id',...(selection ?? defaults)])].filter(key=>byKey.has(key)).slice(0,6).map(key=>byKey.get(key)!);
}

export function filterCaseTable(cases:TestCase[],columns:CaseColumn[],view:CaseTableView,advancedFiltersEnabled=true):TestCase[] {
  const query=normalize(view.query);
  const byKey=new Map(columns.map(c=>[c.key,c]));
  return cases.filter(item=>{
    if(view.status!=='All' && item.status!==view.status) return false;
    if(query && !columns.some(column=>normalize(caseColumnValue(item,column)).includes(query))) return false;
    return !advancedFiltersEnabled || view.filters.every(filter=>{
      const column=byKey.get(filter.column);
      if(!column) return true; // Preserve filters while the workbook is loading.
      const value=normalize(caseColumnValue(item,column));
      if(filter.operator==='empty') return !value;
      if(filter.operator==='not-empty') return !!value;
      return filter.operator==='equals' ? value===normalize(filter.value) : value.includes(normalize(filter.value));
    });
  });
}

export function parseCaseTableView(serialized:string|null):CaseTableView {
  const fallback:CaseTableView={query:'',status:'All',selected:null,filters:[]};
  try {
    const value=JSON.parse(serialized ?? 'null');
    if(!value || value.version!==1) return fallback;
    return {version:1,query:typeof value.query==='string'?value.query.slice(0,500):'',status:TEST_STATUSES.includes(value.status)?value.status:'All',
      selected:Array.isArray(value.selected)?[...new Set(value.selected.filter((key:unknown)=>typeof key==='string'))].slice(0,6) as string[]:null,
      filters:Array.isArray(value.filters)?value.filters.filter((filter:unknown):filter is CaseTableFilter=>{
        if(!filter || typeof filter!=='object') return false;
        const f=filter as CaseTableFilter;
        return typeof f.column==='string' && ['contains','equals','empty','not-empty'].includes(f.operator) && typeof f.value==='string';
      }).slice(0,20):[]};
  } catch {return fallback;}
}

export function caseTableStorageKey(userId:string,projectId:string) {
  return `qa-case-table:v1:${JSON.stringify([userId,projectId])}`;
}
