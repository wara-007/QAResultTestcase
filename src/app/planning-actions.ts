"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProjectCapability } from "@/lib/project-access-server";
import type { ProjectHistoryEntry } from "@/lib/types";
import { loadPlanning, loadPlanningTeam } from "@/lib/planning-server";
import { loadTestCaseAssignments } from '@/lib/case-assignments-server';

export async function getTestCaseAssignments(projectId:string) {
  try {return {...await loadTestCaseAssignments(projectId),error:''};}
  catch(reason) {return {team:[],assignments:[],cases:[],error:reason instanceof Error ? reason.message : 'โหลดผู้รับผิดชอบไม่สำเร็จ'};}
}

export async function setTestCaseQa(projectId:string,targets:{caseId:string;sourceSheet:string}[],userIds:string[]) {
  try {
    if(!Array.isArray(targets) || !targets.length || targets.length>500 || !Array.isArray(userIds) || userIds.length>100) throw new Error('เลือก 1–500 แถว และ QA ไม่เกิน 100 คน');
    const access=await requireProjectCapability(projectId,'edit');
    const result=await access.supabase.rpc('set_test_case_qa',{requested_project_id:projectId,requested_case_ids:targets.map(t=>t.caseId),requested_source_sheets:targets.map(t=>t.sourceSheet),requested_user_ids:userIds});
    if(result.error) return {error:result.error.message};
    revalidatePath(`/groups/${access.project.group_id}`,'layout');
    return {success:true};
  } catch(reason) {return {error:reason instanceof Error ? reason.message : 'มอบหมาย Test case ไม่สำเร็จ'};}
}

export async function getProjectPlanning(projectId: string) {
  const access = await requireProjectCapability(projectId, "view");
  const [planning,team,assigned]=await Promise.all([loadPlanning(access.project.group_id),loadPlanningTeam(access.project.group_id),access.supabase.from('project_qa_assignments').select('user_id').eq('project_id',projectId)]);
  return {...planning,team,qaIds:(assigned.data ?? []).map(a=>a.user_id),error:planning.error || assigned.error?.message || ''};
}

export async function updateSprint(input: {sprintId:string;groupId:string;name:string;startDate:string;endDate:string;goal:string;status:string;expectedUpdatedAt:string}) {
  try {
    const db=await createClient();
    const result=await db.rpc('update_sprint',{requested_sprint_id:input.sprintId,requested_name:input.name.trim(),requested_start:input.startDate || null,requested_end:input.endDate || null,requested_goal:input.goal.trim(),requested_status:input.status,expected_updated_at:input.expectedUpdatedAt});
    if(result.error) return {error:result.error.message};
    revalidatePath(`/groups/${input.groupId}`,'layout');
    return {success:true};
  } catch(reason) {return {error:reason instanceof Error ? reason.message : 'แก้ไข Sprint ไม่สำเร็จ'};}
}

export async function setProjectQa(projectId:string,userIds:string[]) {
  try {
    const access=await requireProjectCapability(projectId,'manage');
    const result=await access.supabase.rpc('set_project_qa',{requested_project_id:projectId,requested_user_ids:userIds});
    if(result.error) return {error:result.error.message};
    const version=await access.supabase.from('projects').select('updated_at').eq('id',projectId).single();
    if(version.error) return {error:version.error.message};
    revalidatePath(`/groups/${access.project.group_id}`,'layout');
    return {success:true,updatedAt:version.data.updated_at};
  } catch(reason) {return {error:reason instanceof Error ? reason.message : 'บันทึก QA ไม่สำเร็จ'};}
}

export async function createWorkspaceYear(groupId: string, year: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2200) return { error: "ระบุปี ค.ศ. ระหว่าง 2000–2200" };
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return { error: "กรุณาเข้าสู่ระบบ" };
  const { error } = await db.from("workspace_years").insert({ group_id: groupId, year, created_by: auth.user.id });
  if (error) return { error: error.code === "23505" ? "มีปีนี้อยู่แล้ว" : error.message };
  revalidatePath(`/groups/${groupId}/years`);
  return { success: true };
}
export async function createSprint(input: { groupId: string; yearId: string; name: string; startDate: string; endDate: string }) {
  const name = input.name.trim();
  if (!name || name.length > 120) return { error: "ชื่อ Sprint ต้องมี 1–120 ตัวอักษร" };
  if (input.startDate && input.endDate && input.endDate < input.startDate) return { error: "วันสิ้นสุดต้องไม่น้อยกว่าวันเริ่ม" };
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return { error: "กรุณาเข้าสู่ระบบ" };
  const { error } = await db.from("sprints").insert({ group_id: input.groupId, year_id: input.yearId, name, start_date: input.startDate || null, end_date: input.endDate || null, created_by: auth.user.id });
  if (error) return { error: error.code === "23505" ? "มีชื่อ Sprint นี้ในปีเดียวกันแล้ว" : error.message };
  revalidatePath(`/groups/${input.groupId}/years`, "layout");
  return { success: true };
}
export async function updateProjectDetails(input: { projectId: string; name: string; description: string; environment: string; sprintId: string; expectedUpdatedAt: string; moveReason?:string }) {
  const name = input.name.trim();
  if (!name || name.length > 160 || !input.environment.trim() || !input.sprintId) return { error: "กรุณาระบุชื่อ Environment และ Sprint" };
  try {
    const access = await requireProjectCapability(input.projectId, "manage");
    const result = await access.supabase.from("projects").update({ name, description: input.description.trim(), environment: input.environment.trim(), sprint_id: input.sprintId,last_move_reason:input.moveReason?.trim() ?? '' })
      .eq("id", input.projectId).eq("updated_at", input.expectedUpdatedAt).select("id,updated_at,sprint_no");
    if (result.error) return { error: result.error.message };
    if (!result.data?.length) return { error: "Project ถูกเปลี่ยนโดยผู้ใช้อื่น กรุณาโหลดใหม่ก่อนแก้ไข" };
    revalidatePath(`/groups/${access.project.group_id}`, "layout");
    return { success: true, updatedAt: result.data[0].updated_at, sprintNo: result.data[0].sprint_no };
  } catch (error) { return { error: error instanceof Error ? error.message : "แก้ไข Project ไม่สำเร็จ" }; }
}
export async function getProjectHistory(projectId: string, offset = 0): Promise<{ entries: ProjectHistoryEntry[]; error: string }> {
  try {
    const access = await requireProjectCapability(projectId, "view");
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("หน้าประวัติไม่ถูกต้อง");
    const result = await access.supabase.from("project_history").select("id,actor_email,before_data,after_data,created_at").eq("project_id", projectId).order("created_at", { ascending: false }).order("id").range(offset, offset + 49);
    return { entries: (result.data ?? []) as ProjectHistoryEntry[], error: result.error?.message ?? "" };
  } catch (error) { return { entries: [], error: error instanceof Error ? error.message : "โหลดประวัติไม่สำเร็จ" }; }
}
