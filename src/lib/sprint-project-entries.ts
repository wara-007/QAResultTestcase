import type { SprintProjectEntry } from './project-sprint-participation';
export function filterSprintProjectEntries(entries:SprintProjectEntry[],filters:{query:string;qaId:string;scope:'all'|'current'|'continued'}) {
 const query=filters.query.trim().toLocaleLowerCase();
 return entries.filter(e=>(!query || `${e.name} ${e.historical?.project.description ?? ''}`.toLocaleLowerCase().includes(query)) && (!filters.qaId || (e.qaIds ?? e.historical?.qa.map(q=>q.userId) ?? []).includes(filters.qaId)) && (filters.scope==='all' || e.kind===filters.scope));
}
export function sprintEntryHref(entry:SprintProjectEntry,groupId:string,year:number) {
 return entry.kind==='current' ? `/groups/${groupId}/projects/${entry.projectId}/test-cases` : `/groups/${groupId}/years/${year}/sprints/${entry.sprintId}/projects/${entry.projectId}/history/${entry.participationId}`;
}
