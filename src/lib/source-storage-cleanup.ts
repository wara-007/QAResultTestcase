export type CleanupSource = {id:string;project_id:string;version_no:number;storage_provider:string;storage_key:string;byte_size:number;column_mapping:Record<string,unknown>|null};

export function sourceStoragePaths(source:CleanupSource) {
 const key=source.storage_key;
 if(!key.startsWith(`${source.project_id}/${source.id}/`) || key.split('/').some(part=>!part || part==='.' || part==='..') || key.includes('\\')) throw new Error('Invalid source storage path');
 const count=source.column_mapping?.chunkCount ?? 0;
 if(typeof count!=='number' || !Number.isSafeInteger(count) || count<0 || count>10000) throw new Error('Invalid source chunk count');
 return count ? Array.from({length:count},(_,i)=>`${key}/part-${String(i).padStart(3,'0')}`) : [key];
}

export function planSourceStorageCleanup({projects,sources,references,verifiedProjectIds}:{projects:{id:string;google_sheet_id:string|null}[];sources:CleanupSource[];references:unknown[];verifiedProjectIds:readonly string[]}) {
 const latest=new Map<string,CleanupSource>();
 for(const source of sources) if(!latest.has(source.project_id) || source.version_no>=latest.get(source.project_id)!.version_no) latest.set(source.project_id,source);
 const linked=new Set(projects.filter(project=>project.google_sheet_id).map(project=>project.id));
 const verified=new Set(verifiedProjectIds);
 const serialized=JSON.stringify(references);
 const retained:{id:string;reason:string}[]=[],eligible:CleanupSource[]=[];
 for(const source of sources) {
  let reason='';
  if(!linked.has(source.project_id)) reason='local-upload';
  else if(latest.get(source.project_id)?.id===source.id) reason='latest';
  else if(!verified.has(source.project_id)) reason='unverified-project';
  else if(source.column_mapping?.sourceOrigin !== 'google-sheets' || (source.column_mapping?.sheetImport as {spreadsheetId?:string}|undefined)?.spreadsheetId !== projects.find(project=>project.id===source.project_id)?.google_sheet_id) reason='unproven-sheets-origin';
  else if(source.storage_provider!=='supabase' || !source.storage_key || source.byte_size<=0) reason='no-supabase-object';
  else if(serialized.includes(source.id) || serialized.includes(source.storage_key)) reason='referenced';
  else if(sources.some(other=>other.id!==source.id && other.storage_key===source.storage_key)) reason='shared-storage-path';
  else {try{sourceStoragePaths(source);}catch{reason='invalid-storage-path';}}
  if(reason)retained.push({id:source.id,reason});else eligible.push(source);
 }
 return {eligible,retained,bytes:eligible.reduce((sum,source)=>sum+Number(source.byte_size),0)};
}
