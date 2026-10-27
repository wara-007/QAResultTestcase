import type {SupabaseClient} from '@supabase/supabase-js';
/** Call only after loading projects through the authenticated user's RLS. */
export async function readProjectCreatorNames(db:SupabaseClient,visibleProjects:readonly {owner_id:string}[]):Promise<Map<string,string>> {
  const ids=[...new Set(visibleProjects.map(project=>project.owner_id).filter(Boolean))];
  const names=new Map<string,string>();
  for(let offset=0;offset<ids.length;offset+=100){
    const result=await db.from('profiles').select('id,display_name').in('id',ids.slice(offset,offset+100));
    if(result.error)throw new Error(result.error.message);
    for(const row of result.data??[])if(typeof row.display_name==='string'&&row.display_name.trim())names.set(row.id,row.display_name.trim());
  }
  return names;
}
