import type {SupabaseClient} from '@supabase/supabase-js';
import type {PlanningTeamMember} from './types';
import {readAllRows as allRows} from './paged-rows';
export async function readPlanningTeam(db:SupabaseClient,groupId:string):Promise<PlanningTeamMember[]> {
  const rows=await allRows<{user_id:string;email:string;display_name:string;role:string}>((a,b)=>db.rpc('planning_team',{requested_group_id:groupId}).order('user_id').range(a,b));
  return rows.map(row=>({userId:row.user_id,email:row.email,name:row.display_name,role:row.role}));
}

