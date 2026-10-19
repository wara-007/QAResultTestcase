import type { PlanningTeamMember, Project, WorkbookSource } from './types';
import type { ApprovalTotals, MoveSnapshot } from './sprint-dashboard';

export type Participation = {
  id:string; projectId:string; sprintId:string; enteredAt:string|null; exitedAt:string|null;
  previousId:string|null; nextId:string|null; actorName:string; reason:string;
  snapshotKind:'full'|'legacy-summary'|'none';
};
export type SnapshotHeader = {
  version:1; participation:Participation;
  project:Pick<Project,'id'|'name'|'description'|'environment'>;
  counts:MoveSnapshot; qa:PlanningTeamMember[]; approval:ApprovalTotals;
  source:Omit<WorkbookSource,'buffer'|'bufferLoaded'>|null;
  destination?:{sprintId:string;sprintName:string;year:number};
};
export type SnapshotCase = { snapshotId:string; position:number; testCase:import('./types').TestCase };
export type SprintProjectEntry = {
  projectId:string; sprintId:string; name:string; kind:'current'|'continued'; participationId:string;
  destination:{sprintId:string;sprintName:string;year:number}|null; historical:SnapshotHeader|null;
  previousSprintName?:string;
  qaIds?:string[];
};
export function selectSprintProjectEpisodes(sprintId:string, episodes:Participation[]):Participation[] {
  const selected=new Map<string,Participation>();
  for(const episode of episodes) {
    if(episode.sprintId!==sprintId) continue;
    const previous=selected.get(episode.projectId);
    if(!previous || (previous.exitedAt!==null && (episode.exitedAt===null || `${episode.exitedAt}:${episode.id}`>`${previous.exitedAt}:${previous.id}`))) selected.set(episode.projectId,episode);
  }
  return [...selected.values()];
}
