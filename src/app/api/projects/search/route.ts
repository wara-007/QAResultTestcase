import { createClient } from '@/lib/supabase/server';
import { globalProjectSearchResponse, type ProjectSearchRow } from '@/lib/global-project-search';

export async function GET(request:Request) {
  const db=await createClient();
  return globalProjectSearchResponse(request,{
    authorize:async()=>{
      const {data,error}=await db.auth.getClaims();
      if(error || typeof data?.claims?.sub!=='string') throw Object.assign(new Error('Login required'),{status:401});
      const access=await db.rpc('is_app_authorized');
      if(access.error) throw access.error;
      if(access.data!==true) throw Object.assign(new Error('Access denied'),{status:403});
    },
    search:async pattern=>{
      // Session/RLS client only. Never use the admin client for global search.
      const {data,error}=await db.from('projects').select('id,name,environment,group_id,sprint_no,groups(name),sprints(name,workspace_years(year))')
        .ilike('name',pattern).order('name').order('id').limit(26);
      if(error) throw error;
      return data as unknown as ProjectSearchRow[];
    },
  });
}
