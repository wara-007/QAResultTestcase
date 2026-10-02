import 'server-only';
import { google, type drive_v3 } from 'googleapis';
import { createAdminClient } from './supabase/admin';
import { googleOAuthClient, getGoogleUserAuth, openGoogleToken } from './google-user-oauth';
import { isOwnedGoogleEvidence } from './evidence-cleanup';
import type { TestEvidence } from './types';
import { readAllRows } from './paged-rows';

const safeName=(name:string)=>name.replace(/[\\/:*?"<>|]+/g,'_').trim().slice(0,120) || 'Untitled';
async function legacyFolder(drive:drive_v3.Drive,parents:string[],projectName:string) {
  // Legacy uploads: case folder -> project folder -> QA Result Evidence root.
  for(const parent of parents) {
    const caseFolder=(await drive.files.get({fileId:parent,fields:'mimeType,parents'})).data;
    if(caseFolder.mimeType!=='application/vnd.google-apps.folder') continue;
    for(const projectId of caseFolder.parents ?? []) {
      const project=(await drive.files.get({fileId:projectId,fields:'name,mimeType,parents'})).data;
      if(project.name!==safeName(projectName) || project.mimeType!=='application/vnd.google-apps.folder') continue;
      for(const rootId of project.parents ?? []) {
        const root=(await drive.files.get({fileId:rootId,fields:'name,mimeType'})).data;
        if(root.name==='QA Result Evidence' && root.mimeType==='application/vnd.google-apps.folder') return true;
      }
    }
  }
  return false;
}

export async function trashProjectGoogleEvidence(project:{id:string;name:string;owner_id:string;group_id:string},evidence:TestEvidence[]) {
  const admin=createAdminClient();
  const members=await readAllRows((a,b)=>admin.from('group_members').select('user_id').eq('group_id',project.group_id).order('user_id').range(a,b));
  const users=[...new Set([project.owner_id,...members.map(m=>m.user_id),...evidence.map(e=>e.uploadedBy)].filter((id):id is string=>Boolean(id)))];
  const connections=await readAllRows((a,b)=>admin.from('google_oauth_connections').select('user_id,token_ciphertext').in('user_id',users).order('user_id').range(a,b));
  const drives:drive_v3.Drive[]=[];
  try {drives.push(google.drive({version:'v3',auth:await getGoogleUserAuth()}));} catch { /* Try stored uploader connections. */ }
  for(const connection of connections) {
    try { const oauth=googleOAuthClient();oauth.setCredentials(openGoogleToken(connection.token_ciphertext));drives.push(google.drive({version:'v3',auth:oauth})); } catch { /* An expired connection must not mask a working one. */ }
  }
  // Tagged uploads also include files attached to an unsaved/deleted Result.
  // Never list or delete a folder wholesale: it may contain original Sheets.
  const targets=new Map(evidence.map(item=>[item.fileId,item]));
  let listingFailure=false;
  for(const drive of drives) {
    try {
      let pageToken:string|undefined;
      do {
        const response=await drive.files.list({q:`trashed=false and appProperties has { key='qaProjectId' and value='${project.id.replace(/'/g,"\\'")}' }`,fields:'nextPageToken,files(id,name,mimeType)',pageSize:100,pageToken});
        for(const file of response.data.files ?? []) if(file.id) targets.set(file.id,{fileId:file.id,name:file.name ?? '',mimeType:file.mimeType ?? '',provider:'google-drive',uploadedBy:project.owner_id});
        pageToken=response.data.nextPageToken ?? undefined;
      } while(pageToken);
    } catch { listingFailure=true; }
  }
  let count=0;
  for(const item of targets.values()) {
    let handled=false;
    let failure='ไม่มีบัญชี Google ที่มีสิทธิ์ลบไฟล์นี้';
    for(const drive of drives) {
      try {
        const file=(await drive.files.get({fileId:item.fileId,fields:'id,name,mimeType,parents,appProperties,trashed'})).data;
        const legacy=!file.appProperties?.qaProjectId && /^\d{13}-/.test(file.name ?? '') ? await legacyFolder(drive,file.parents ?? [],project.name) : false;
        if(!isOwnedGoogleEvidence(file,project.id,legacy)) {
          if(!file.appProperties?.qaProjectId && (item.uploadedBy || /^\d{13}-/.test(item.name)) && (file.mimeType?.startsWith('image/') || file.mimeType?.startsWith('video/'))) throw new Error('ยังยืนยันที่มาของรูปเก่าไม่ได้ จึงไม่ลบไฟล์นี้โดยอัตโนมัติ');
          handled=true;break;
        }
        if(!file.trashed) {await drive.files.update({fileId:item.fileId,requestBody:{trashed:true},fields:'id'});count++;}
        handled=true;break;
      } catch(reason) {failure=reason instanceof Error ? reason.message : failure;}
    }
    // Imported evidence is a reference, not an app-owned upload. Known app
    // uploads fail explicitly so the caller can show a non-blocking warning.
    if(!handled && (item.uploadedBy || /^\d{13}-/.test(item.name))) throw new Error(`ลบหลักฐาน Google ไม่สำเร็จ (${item.name}): ${failure}`);
  }
  if(listingFailure) throw new Error('ไม่สามารถตรวจไฟล์ Google ของ Project ได้ครบ');
  return count;
}
