import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProjectEvidenceProgress } from './project-evidence-progress';

test('a failed import is not presented as waiting to start even when Sheets needs refresh', () => {
  const html = renderToStaticMarkup(React.createElement(ProjectEvidenceProgress, {
    projectName:'Project', names:['TC_01'], states:{TC_01:'error'}, progress:{},
    active:false, ready:false, persistedImages:0, refreshRequired:true,
    errorMessage:'canceling statement due to statement timeout', canRetry:true, onRetry:()=>{},
  }));
  assert.match(html, /นำเข้าหยุดชั่วคราว/);
  assert.doesNotMatch(html, /รอเริ่มนำเข้า/);
});

test('all legacy tabs loaded without an evidence inventory is unverified rather than incomplete', () => {
  const html = renderToStaticMarkup(React.createElement(ProjectEvidenceProgress, {
    projectName:'Project',names:['TC_01'],states:{TC_01:'loaded'},progress:{},
    active:false,ready:false,persistedImages:0,canRetry:true,onRetry:()=>{},
  }));
  assert.match(html,/ยังไม่พร้อมส่ง PO/);
  assert.doesNotMatch(html,/นำเข้ายังไม่ครบ|รอเริ่มนำเข้า|ลองนำเข้าส่วนที่เหลือ/);
});

test('a ready project offers one refresh action in the progress panel', () => {
  const html = renderToStaticMarkup(React.createElement(ProjectEvidenceProgress, {
    projectName:'Project',names:['TC_01'],states:{TC_01:'loaded'},progress:{},
    active:false,ready:true,persistedImages:2,expectedImages:2,canRetry:true,onRetry:()=>{},
    actionLabel:'อัปเดตข้อมูลจาก Sheets',
  }));
  assert.match(html,/อัปเดตข้อมูลจาก Sheets/);
});

test('a failed refresh never presents the old completed snapshot as a successful update',()=>{
 const html=renderToStaticMarkup(React.createElement(ProjectEvidenceProgress,{projectName:'Project',names:['TC_01'],states:{TC_01:'loaded'},progress:{},active:false,ready:true,expectedImages:1,persistedImages:1,errorMessage:'statement timeout',canRetry:true,onRetry:()=>{}}));
 assert.match(html,/นำเข้าหยุดชั่วคราว/);assert.doesNotMatch(html,/บันทึกหลักฐานครบแล้ว/);
});
test('the warning identifies which loaded tab is still missing evidence',()=>{
 const html=renderToStaticMarkup(React.createElement(ProjectEvidenceProgress,{projectName:'Project',names:['SUN-8073_01'],states:{'SUN-8073_01':'loaded'},progress:{},active:false,ready:false,expectedImages:2,persistedImages:1,missingEvidence:[{sheetName:'SUN-8073_01'}],canRetry:true,onRetry:()=>{}}));
 assert.match(html,/ยังขาดรูปหลักฐาน 1 รูป/);
 assert.match(html,/SUN-8073_01 \(1 รูป\)/);
 assert.match(html,/อ่านข้อมูลแล้ว/);
 assert.doesNotMatch(html,/บันทึกหลักฐานครบแล้ว/);
});

test('completed images do not show a full progress bar while project tabs remain queued',()=>{
 const names=Array.from({length:23},(_,i)=>`Tab${i}`);
 const states=Object.fromEntries(names.map((name,i)=>[name,i<4?'loaded' as const:'queued' as const]));
 const html=renderToStaticMarkup(React.createElement(ProjectEvidenceProgress,{projectName:'Pay ban cancel',names,states,progress:{},active:false,ready:false,expectedImages:239,persistedImages:239,canRetry:true,onRetry:()=>{}}));
 assert.match(html,/เหลือข้อมูลอีก 19 แท็บ/);
 assert.doesNotMatch(html,/role="progressbar"/);
 assert.match(html,/239\/239/);
});
