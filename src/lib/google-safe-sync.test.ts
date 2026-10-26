import assert from "node:assert/strict";
import test, { mock } from "node:test";
import Module, { createRequire } from "node:module";
import { google } from "googleapis";

// Next aliases this marker during bundling; Node's test runner needs the same
// empty marker to exercise the server module without a running Next server.
const loader = Module as unknown as { _load: (...args: unknown[]) => unknown };
const originalLoad = loader._load;
const marker = mock.method(loader, "_load", function (this: unknown, ...args: unknown[]) {
  return args[0] === "server-only" ? {} : Reflect.apply(originalLoad, this, args);
});
const { readGoogleSheet, writeGoogleSheetResults } = createRequire(__filename)("./google-sheets") as typeof import("./google-sheets");
marker.mock.restore();

const api = google as unknown as { drive: () => unknown; sheets: () => unknown };
const auth = {} as Parameters<typeof writeGoogleSheetResults>[2];
import { casesFromRows } from './testcase-rows';

function fakeWorkbook(rows: unknown[][], names = ['Testcase','Proof']) {
 const tabs=names.map((title,sheetId)=>({properties:{title,sheetId,gridProperties:{rowCount:20}}}));
 const cells=new Map<string,unknown[][]>([["'Testcase'",rows]]);
 const writes: Array<{range:string;values:unknown[][]}> = [];
 const requests: unknown[]=[];
 const drive=mock.method(api,'drive',()=>({files:{get:async()=>({data:{mimeType:'application/vnd.google-apps.spreadsheet'}})},permissions:{list:async()=>({data:{permissions:[{type:'anyone',role:'reader'}]}})}}));
 const sheets=mock.method(api,'sheets',()=>({spreadsheets:{
  get:async()=>({data:{sheets:tabs}}),
  batchUpdate:async(args:{requestBody:{requests:Array<{addSheet?:{properties:{title:string}};appendDimension?:{sheetId:number;length:number}}>}})=>{for(const request of args.requestBody.requests){requests.push(request);if(request.appendDimension){const tab=tabs.find(item=>item.properties.sheetId===request.appendDimension!.sheetId);if(tab)tab.properties.gridProperties.rowCount+=request.appendDimension.length;}if(request.addSheet)tabs.push({properties:{title:request.addSheet.properties.title,sheetId:tabs.length,gridProperties:{rowCount:20}}});}return {data:{}};},
  values:{get:async(args:{range:string})=>({data:{values:Array.from(cells.get(args.range)??cells.get(args.range.split('!')[0])??[],row=>row??[])}}),batchGet:async(args:{ranges:string[]})=>({data:{valueRanges:args.ranges.map(range=>({values:Array.from(cells.get(range.split('!')[0])??[],row=>row??[])}))}}),batchUpdate:async(args:{requestBody:{data:typeof writes}})=>{writes.push(...args.requestBody.data);for(const write of args.requestBody.data){const match=write.range.match(/^('(?:[^']|'')+')!([A-Z]+)([0-9]+)/);if(!match)continue;const key=match[1];const current=cells.get(key)??[];const column=[...match[2]].reduce((value,letter)=>value*26+letter.charCodeAt(0)-64,0)-1;write.values.forEach((row,index)=>{const target=Number(match[3])-1+index;current[target]??=[];row.forEach((value,offset)=>{current[target][column+offset]=value;});});cells.set(key,current);}return {data:{totalUpdatedCells:10}};},clear:async()=>{throw new Error('must preserve existing source cells');},batchClear:async()=>{throw new Error('must preserve existing source cells');}}
 }}));
 return {tabs,writes,requests,cells,restore(){drive.mock.restore();sheets.mock.restore();}};
}
const webResult = {id:'web-1',source:'web' as const,status:'Pass' as const,actualResult:'Web result',apiResponse:'',log:'',evidence:[],createdAt:'2026-10-26'};

test('mixed Ref register sync skips untouched no-Ref rows and creates a safe destination for their later web results',async()=>{
 const rows=[['Testcase ID','Test Case Name','Ref (Result Testing)','Status'],['TC01','First','Proof','Not Start'],['TC02','Untouched','','Not Start']];
 const cases=casesFromRows(rows); cases[0].results=[webResult];
 const workbook=fakeWorkbook(rows);
 try {
  assert.equal((await writeGoogleSheetResults('fake',cases,auth)).resultSheets,1);
  assert.ok(workbook.writes.some(write=>write.range.startsWith("'Proof'!A21")));
  cases[1].results=[{...webResult,id:'web-2'}];
  await writeGoogleSheetResults('fake',cases,auth);
  assert.ok(workbook.tabs.some(tab=>tab.properties.title==='TC02'));
  assert.ok(workbook.writes.some(write=>write.range.startsWith("'TC02'!A21")));
 } finally {workbook.restore();}
});

test('ordinary Ref sync preserves defect evidence, master/detail custom fields and returns a defect count',async()=>{
 const rows=[['Testcase ID','Extra','Ref (Result Testing)','Status'],['TC01','original','Proof','Not Start']];
 const cases=casesFromRows(rows); const item=cases[0];
 item.customFields![0].value='edited';
 item.customFields!.push({key:'detail:extra',label:'Detail Extra',value:'detail edit',source:'detail',sheetName:'Proof',row:2,column:1});
 item.defects=[{id:'web-defect',status:'Open',title:'Broken screen',description:'description',apiResponse:'api',log:'log',jiraUrl:'https://jira.example/QA-1',createdAt:'2026-10-26',evidence:[{fileId:'https://example.com/evidence.png',provider:'external-url',url:'https://example.com/evidence.png',name:'proof',mimeType:'image/png'}]}];
 const workbook=fakeWorkbook(rows);
 try {
  const synced=await writeGoogleSheetResults('fake',cases,auth);
  assert.equal(synced.defects,1);
  assert.ok(workbook.writes.some(write=>write.range==="'Testcase'!B2" && write.values[0][0]==='edited'));
  const payload=workbook.writes.find(write=>write.range.startsWith("'Proof'!A21"))!.values;
  assert.match(JSON.stringify(payload),/Broken screen/);
  assert.match(JSON.stringify(payload),/detail edit/);
  assert.match(JSON.stringify(payload),/evidence.png/);
  assert.ok(workbook.writes.some(write=>/Defected/.test(write.range) && JSON.stringify(write.values).includes('Broken screen')));
  const refreshed=await readGoogleSheet('fake',auth,{testcaseId:'TC01'});
  const restored=refreshed.cases.find(item=>item.id==='TC01')!;
  assert.equal(restored.defects?.[0].title,'Broken screen');
  assert.equal(restored.defects?.[0].evidence[0].fileId,'https://example.com/evidence.png');
  assert.equal(restored.customFields?.find(field=>field.key==='detail:extra')?.value,'detail edit');
  assert.equal(restored.customFields?.find(field=>field.source==='testcase')?.value,'edited');
 } finally {workbook.restore();}
});

test('no-Ref duplicate rows get valid destinations and reload with their own results',async()=>{
 const rows=[['Testcase ID','Test Case Name','Status'],['TC01','First','Not Start'],['TC01','Second','Not Start']];
 const {assignRegisterCaseIdentities}=await import('./register-case-identity');
 const cases=assignRegisterCaseIdentities(casesFromRows(rows));
 cases.forEach((item,index)=>{item.results=[{...webResult,id:`web-${index}`,actualResult:item.name}];});
 const workbook=fakeWorkbook(rows,['Testcase']);
 try {
  await writeGoogleSheetResults('fake',cases,auth);
  assert.ok(workbook.tabs.every(tab=>!/[\\/?*\[\]:]/.test(tab.properties.title)));
  const lazy=await readGoogleSheet('fake',auth,{testcaseId:cases[0].id});
  assert.equal(lazy.cases.find(item=>item.id===cases[0].id)?.results?.find(result=>result.source==='web')?.actualResult,'First');
  const reloaded=await readGoogleSheet('fake',auth);
  for(const item of reloaded.cases.filter(item=>item.sourceRow>0))assert.equal(item.results?.find(result=>result.source==='web')?.actualResult,item.name);
 } finally {workbook.restore();}
});

test('repeated safe sync updates the same defect without Jira and keeps edited custom cells',async()=>{
 const rows=[['Testcase ID','Extra','Ref (Result Testing)','Status'],['TC01','original','Proof','Not Start']];
 const cases=casesFromRows(rows);cases[0].customFields![0].value='edited';
 cases[0].defects=[{id:'web-defect',status:'Open',title:'Broken screen',description:'description',apiResponse:'',log:'',jiraUrl:'',createdAt:'2026-10-26',evidence:[]}];
 const workbook=fakeWorkbook(rows);
 try {
  await writeGoogleSheetResults('fake',cases,auth);
  cases[0].defects[0].status='Closed';
  await writeGoogleSheetResults('fake',cases,auth);
  const reloaded=await readGoogleSheet('fake',auth,{summary:true});
  assert.equal(reloaded.sheets.find(sheet=>sheet.name==='Defected')?.defects?.length,1);
  assert.equal(reloaded.sheets.find(sheet=>sheet.name==='Defected')?.defects?.[0].status,'Closed');
 } finally {workbook.restore();}
});

for (const legacy of [false, true]) test(`identical duplicate definitions retain snapshots after a Ref reorder before client alignment (${legacy ? 'old' : 'new'} snapshots)`,async()=>{
 const rows=[['Testcase ID','Test Case Name','Ref (Result Testing)','Status'],['TC01','Same definition','Proof A','Not Start'],['TC01','Same definition','Proof B','Not Start']];
 const {assignRegisterCaseIdentities}=await import('./register-case-identity');
 const cases=assignRegisterCaseIdentities(casesFromRows(rows));
 cases.forEach(item=>{item.results=[{...webResult,id:`web-${item.resultReference}`,actualResult:`QA ${item.resultReference}`}];item.defects=[{id:`bug-${item.resultReference}`,status:'Open',title:item.resultReference,description:'',apiResponse:'',log:'',jiraUrl:'',createdAt:'',evidence:[]}];});
 const workbook=fakeWorkbook(rows,['Testcase','Proof A','Proof B']);
 try {
  await writeGoogleSheetResults('fake',cases,auth);
  if(legacy) for(const tab of workbook.cells.values()) for(const row of tab) if(row?.[0]==='QA Workspace Results v1') row.splice(3);
  [rows[1],rows[2]]=[rows[2],rows[1]];
  const loaded=await readGoogleSheet('fake',auth);
  for(const item of loaded.cases.filter(item=>item.sourceRow>0)) {
   assert.equal(item.results?.find(result=>result.source==='web')?.actualResult,`QA ${item.resultReference}`);
   assert.equal(item.defects?.find(defect=>defect.id.startsWith('bug-'))?.title,item.resultReference);
  }
 } finally {workbook.restore();}
});
