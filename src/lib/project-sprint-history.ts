import { validateSnapshotHeader } from './project-sprint-snapshot';
export function snapshotPage(offset=0,limit=10) {
  if(!Number.isSafeInteger(offset) || offset<0 || !Number.isSafeInteger(limit) || limit<1) throw new Error('หน้าประวัติไม่ถูกต้อง');
  return {offset,limit:Math.min(limit,50)};
}
export function matchingSnapshotHeader(value:unknown, ids:{projectId:string;sprintId:string;participationId:string}) {
  const header=validateSnapshotHeader(value);
  if(header.project.id!==ids.projectId || header.participation.projectId!==ids.projectId || header.participation.sprintId!==ids.sprintId || header.participation.id!==ids.participationId) throw new Error('ไม่พบข้อมูลย้อนหลังใน Sprint นี้');
  return header;
}
