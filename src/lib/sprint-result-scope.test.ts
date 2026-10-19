import assert from 'node:assert/strict';
import test from 'node:test';
import { classifySprintResult, mergeSprintPersonalCases } from './sprint-result-scope';
import type { PersonalCase } from './personal-test-performance';
import { buildPersonalPerformance } from './personal-test-performance';
test('known old origins and entrance baseline never become new Sprint work',()=>{
 assert.equal(classifySprintResult({id:'r',origin:{sprintId:'67',inferred:false}},'68',[]),'carried');
 assert.equal(classifySprintResult({id:'r',origin:{sprintId:'68',inferred:false}},'68',[]),'current');
 assert.equal(classifySprintResult({id:'r'},'68',['r']),'carried');
 assert.equal(classifySprintResult({id:'r'},'68',[]),'unknown');
});
test('legacy register fallback remains carried in A → B → C and does not invent pending work',()=>{
 const item:PersonalCase={projectId:'p',projectName:'Project',currentSprintId:'b',caseId:'TC01',caseName:'Case',sourceRowKey:'',detailPath:'/live',assignedUserIds:[],results:[{id:'register:record',testerName:'QA',status:'Pass',source:'sheets',sourceSheet:'',recordedAt:'',order:1,inferred:true}]};
 const baseline=[{projectId:'p',caseId:'TC01',sourceSheet:'',resultId:'legacy'}];
 const active=mergeSprintPersonalCases([item],[],'b',baseline);
 assert.equal(buildPersonalPerformance({sprintId:'b',members:[],cases:active}).flatMap(r=>r.entries).length,0);
 const closed=mergeSprintPersonalCases([],[{...item,results:[{...item.results[0],id:'legacy'}],snapshotAt:'2026-01-02',baselineResultIds:['legacy']}],'b',[]);
 assert.equal(buildPersonalPerformance({sprintId:'b',members:[],cases:closed}).flatMap(r=>r.entries).length,0);
});
test('episode chronology wins over UUID/input order and preserves the newer history link',()=>{
 const item:PersonalCase={projectId:'p',projectName:'Old',currentSprintId:'a',caseId:'TC01',caseName:'Case',sourceRowKey:'',detailPath:'/old',assignedUserIds:[],results:[{id:'r',testerName:'QA',status:'Failed',source:'web',sourceSheet:'',recordedAt:'2026-01-01',order:1,inferred:false,originSprintId:'a'}]};
 const old={...item,snapshotAt:'2026-01-01'};
 const recent={...item,snapshotAt:'2026-02-01',detailPath:'/new',results:[{...item.results[0],status:'Pass'}]};
 const merged=mergeSprintPersonalCases([],[recent,old],'a',[]);
 assert.equal(merged[0].results[0].status,'Pass');assert.equal(merged[0].detailPath,'/new');
 const reentered=mergeSprintPersonalCases([{...item,detailPath:'/live',results:[]}],[recent,old],'a',[]);
 assert.equal(buildPersonalPerformance({sprintId:'a',members:[],cases:reentered})[0].entries[0].detailPath,'/new');
});
test('frozen personal work survives live deletion and shared/episode duplication does not inflate results',()=>{
 const old:PersonalCase={projectId:'p',projectName:'Old',currentSprintId:'67',caseId:'TC01',caseName:'Case',sourceRowKey:'shared',detailPath:'/history',assignedUserIds:[],results:[{id:'r',testerName:'QA',status:'Skip',source:'sheets',sourceSheet:'shared',recordedAt:'2026-01-01',order:0,inferred:false,originSprintId:'67'}]};
 const live={...old,currentSprintId:'68',results:[]};
 const result=mergeSprintPersonalCases([live],[old,old],'67',[]);
 assert.equal(result.length,1);assert.equal(result[0].results.length,1);assert.equal(result[0].results[0].status,'Skip');assert.equal(result[0].detailPath,'/history');
 assert.equal(mergeSprintPersonalCases([{...old,currentSprintId:'68',results:[{...old.results[0],inferred:true,originSprintId:undefined}]}],[],'68',[{projectId:'p',caseId:'TC01',sourceSheet:'shared',resultId:'r'}])[0].results.length,0);
 assert.equal(mergeSprintPersonalCases([],[{...old,results:[{...old.results[0],inferred:true,originSprintId:'66'}]}],'67',[])[0].results.length,0);
});
