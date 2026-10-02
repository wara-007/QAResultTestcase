import 'server-only';
import { requireProjectCapability } from './project-access-server';
import { readAllRows } from './paged-rows';
import type { PlanningTeamMember } from './types';

export async function loadTestCaseAssignments(projectId:string) {
  const access=await requireProjectCapability(projectId,'view');
  const [team,assignments,cases]=await Promise.all([
    readAllRows<{user_id:string;email:string;display_name:string;role:string}>((a,b)=>access.supabase.rpc('eligible_test_qa',{requested_group_id:access.project.group_id}).order('user_id').range(a,b)),
    readAllRows<{test_case_id:string;source_sheet:string;user_id:string}>((a,b)=>access.supabase.from('test_case_qa_assignments').select('test_case_id,source_sheet,user_id,test_cases!inner(project_id)').eq('test_cases.project_id',projectId).order('test_case_id').order('source_sheet').order('user_id').range(a,b)),
    readAllRows<{id:string;testcase_key:string}>((a,b)=>access.supabase.from('test_cases').select('id,testcase_key').eq('project_id',projectId).order('id').range(a,b)),
  ]);
  return {team:team.map(m=>({userId:m.user_id,email:m.email,name:m.display_name,role:m.role}) satisfies PlanningTeamMember),assignments,cases};
}
