export function parseWorkspaceYear(value:string|string[]|undefined):number|undefined {
  if(typeof value!=='string' || !/^\d{4}$/.test(value)) return undefined;
  const year=Number(value);
  return year>=2000 && year<=2200 ? year : undefined;
}
export function availableWorkspaceYears(years:number[],currentYear:number):number[] {
  return [...new Set([...years,currentYear])].filter(year=>Number.isInteger(year) && year>=2000 && year<=2200).sort((a,b)=>b-a);
}
export function groupsForYearHref(year:number):string { return `/groups?year=${year}`; }
export function groupSprintsHref(groupId:string,year:number):string { return `/groups/${encodeURIComponent(groupId)}/years/${year}/sprints`; }
