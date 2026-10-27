import type {Project} from './types';
export function effectiveProjectQa(project:Pick<Project,'id'|'ownerId'>,assignments:readonly {projectId:string;userId:string}[]):string[] {
  const explicit=[...new Set(assignments.filter(item=>item.projectId===project.id).map(item=>item.userId))];
  return explicit.length?explicit:project.ownerId?[project.ownerId]:[];
}
