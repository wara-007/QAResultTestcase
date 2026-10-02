import { GroupsHome } from "@/components/groups-home";
import { loadGroups } from "@/lib/groups-server";
import { WorkspaceYearsHome } from '@/components/workspace-years-home';
import { loadWorkspaceYears } from '@/lib/planning-server';
import { availableWorkspaceYears, parseWorkspaceYear } from '@/lib/year-navigation';
import { notFound } from 'next/navigation';

export const dynamic = "force-dynamic";

export default async function GroupsPage({searchParams}:{searchParams:Promise<{year?:string|string[]}>}) {
  const query=await searchParams;
  const year=parseWorkspaceYear(query.year);
  if(query.year!==undefined && year===undefined) notFound();
  const [{groups,error,currentUser},workspaceYears]=await Promise.all([loadGroups(),year===undefined ? loadWorkspaceYears() : Promise.resolve(null)]);
  if(year!==undefined) return <GroupsHome key={year} initialGroups={groups} error={error} currentUser={currentUser} year={year}/>;
  const currentYear=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Bangkok',year:'numeric'}).format(new Date()));
  return <WorkspaceYearsHome years={availableWorkspaceYears(workspaceYears?.years ?? [],currentYear)} currentYear={currentYear} error={error || workspaceYears?.error || ''} currentUser={currentUser}/>;
}
