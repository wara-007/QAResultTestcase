import type { TestCase } from './types';

export function reviewCasePage(cases: TestCase[], query: string, page: number) {
  const term = query.trim().toLocaleLowerCase();
  const filtered = term ? cases.filter(item => [
    item.id, item.name, item.scenario, item.condition, item.steps, item.expected,
    item.testData, item.executedBy, item.sourceSheetName,
    ...(item.sourceFields ?? []).map(field => field.value),
    ...(item.customFields ?? []).map(field => field.value),
    ...(item.stepDefinitions ?? []).flatMap(step => [step.name, step.description, step.expected]),
  ].some(value => value?.toLocaleLowerCase().includes(term))) : cases;
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.max(1, Math.min(page, pageCount));
  return { total: filtered.length, pageSize, pageCount, currentPage, visible: filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize) };
}
