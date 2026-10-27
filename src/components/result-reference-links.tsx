import React from 'react';
import type {TestCase} from '../lib/types';
import {resultReferenceLinks,isIssueReference,isExternalReferenceText,safeReferenceUrl} from '../lib/result-reference-links';
export function ResultReferenceLinks({testCase}:{testCase:TestCase}) {
  const links=resultReferenceLinks(testCase);
  const names=[...new Set([testCase.resultReference,...(testCase.stepDefinitions??[]).map(step=>step.resultReference??'')])].filter(value=>isExternalReferenceText(value)&&!safeReferenceUrl(value)&&!links.some(link=>link.label===value));
  if(!links.length&&!names.length)return null;
  const documents=names.length>0||links.some(link=>!isIssueReference(link.url));
  return <section className="result-reference-links" aria-label="เอกสารอ้างอิงผลทดสอบ"><h3>Ref (Result Testing)</h3>
    <ul>{links.map(link=><li key={link.url}><span>{link.label}</span><a className="secondary-button" href={link.url} target="_blank" rel="noopener noreferrer">{isIssueReference(link.url)?'เปิด Jira':'เปิดเอกสารผลทดสอบ'}</a></li>)}{names.map(name=><li key={name}><span>{name}</span><small>ยังไม่มีลิงก์ที่บันทึกไว้ · อัปเดตข้อมูลจาก Sheets เพื่ออ่านลิงก์</small></li>)}</ul>
    {documents&&<p>อ้างอิงเอกสารภายนอก · ยังไม่ได้ดึงผลทดสอบและรูปจากเอกสารนี้เข้าระบบ ผู้เปิดต้องมีสิทธิ์เข้าถึงเอกสาร</p>}
  </section>;
}
