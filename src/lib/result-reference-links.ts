import type {TestCase} from './types';
export type ResultReferenceLink={label:string;url:string};
export function safeReferenceUrl(value:unknown):string|undefined {
  if(typeof value!=='string'||value.length>8192)return;
  try {const url=new URL(value.trim());if(['https:','http:'].includes(url.protocol)&&!url.username&&!url.password)return url.href;} catch {}
}
export function isIssueReference(url:string):boolean {try {const value=new URL(url);return /(?:^|\/)browse\/[A-Z][A-Z0-9_]*-\d+\/?$/i.test(value.pathname);}catch{return false;}}
export function isExternalReferenceText(value:string):boolean {return !!safeReferenceUrl(value)||/\.(?:xlsx?|xlsm|csv|pdf|docx?|pptx?)$/i.test(value.trim());}
export function readResultReferenceLinks(value:unknown):ResultReferenceLink[] {
  if(!Array.isArray(value))return [];
  const links=new Map<string,ResultReferenceLink>();
  for(const item of value){const url=safeReferenceUrl(item?.url);if(url&&!links.has(url))links.set(url,{url,label:typeof item.label==='string'&&item.label.trim()?item.label.slice(0,2000):url});}
  return [...links.values()];
}
export function resultReferenceLinks(testCase:Pick<TestCase,'resultReference'|'resultReferenceLinks'|'stepDefinitions'>):ResultReferenceLink[] {
  return readResultReferenceLinks([...(testCase.resultReferenceLinks??[]),...[testCase.resultReference,...(testCase.stepDefinitions??[]).map(step=>step.resultReference)].flatMap(value=>{const url=safeReferenceUrl(value);return url?[{label:value,url}]:[];})]);
}
export function needsReferenceLinkRefresh(cases:readonly TestCase[]):boolean {
  return cases.some(item=>item.resultReferenceLinks===undefined&&[item.resultReference,...(item.stepDefinitions??[]).map(step=>step.resultReference??'')].some(value=>value.trim().length>0));
}
