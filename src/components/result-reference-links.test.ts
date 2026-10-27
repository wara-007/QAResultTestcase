import React from 'react';
import assert from 'node:assert/strict';
import test from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {ResultReferenceLinks} from './result-reference-links';
import {casesFromRows} from '../lib/testcase-rows';
test('external references render safe open links with explicit import status instead of proof images',()=>{
 const item=casesFromRows([['Test Case Id','Ref (Result Testing)'],['MRS-5359','Sanity.xlsx']])[0];
 item.resultReferenceLinks=[{label:'Sanity.xlsx',url:'https://example.sharepoint.com/proof.xlsx'},{label:'Unsafe',url:'javascript:alert(1)'}];
 const html=renderToStaticMarkup(React.createElement(ResultReferenceLinks,{testCase:item}));
 assert.match(html,/เปิดเอกสารผลทดสอบ/);assert.match(html,/ยังไม่ได้ดึงผลทดสอบและรูป/);assert.match(html,/rel="noopener noreferrer"/);
 assert.match(html,/https:\/\/example.sharepoint.com\/proof.xlsx/);assert.doesNotMatch(html,/javascript:|<img|Unsafe/);
});
test('legacy filenames without URLs remain visible without inventing an open link',()=>{
 const item=casesFromRows([['Test Case Id','Ref (Result Testing)'],['MRS-5359','Sanity.xlsx']])[0];
 const html=renderToStaticMarkup(React.createElement(ResultReferenceLinks,{testCase:item}));
 assert.match(html,/Sanity.xlsx/);assert.match(html,/ยังไม่มีลิงก์/);assert.doesNotMatch(html,/<a /);
});
