import type { TestCase, TestStatus } from './types';
import { displayTestCaseId } from './register-case-identity';

export type ParticipationStep = { id: string; name: string; status: string; recordedAt: string };
export type ParticipationCase = { id: string; label: string; name: string; steps: ParticipationStep[]; caseOnly: boolean };
export type ProjectParticipant = { name: string; cases: ParticipationCase[]; stepCount: number; caseOnlyCount: number };

/** Participation is distinct person/case/step, never a count of result attempts. */
export function buildProjectTeamParticipation(cases: TestCase[]): ProjectParticipant[] {
  const people = new Map<string, ProjectParticipant>();
  function add(item: TestCase, rawName: string, step: ParticipationStep | undefined, status: TestStatus | string) {
    const name = rawName.trim().replace(/\s+/g, ' ');
    if (!name || status === 'Not Start' || status === 'Unknown') return;
    const key = name.toLocaleLowerCase();
    let person = people.get(key);
    if (!person) { person = { name, cases: [], stepCount: 0, caseOnlyCount: 0 }; people.set(key, person); }
    let entry = person.cases.find(row => row.id === item.id);
    if (!entry) { entry = { id: item.id, label: displayTestCaseId(item), name: item.name, steps: [], caseOnly: false }; person.cases.push(entry); }
    if (!step) { entry.caseOnly = true; return; }
    const previous = entry.steps.findIndex(row => row.id === step.id);
    if (previous < 0) entry.steps.push(step);
    else if ((Date.parse(step.recordedAt) || 0) > (Date.parse(entry.steps[previous].recordedAt) || 0)) entry.steps[previous] = step;
  }
  for (const item of cases) {
    // Results precede imported definitions so an undated definition cannot
    // overwrite an explicitly recorded result for the same person and Step.
    for (const result of item.results ?? []) {
      const tester = result.customFields?.find(field => /^(executedby|tester|testedby|ผู้ทดสอบ|ชื่อผู้ทดสอบ)$/.test(field.label.toLowerCase().replace(/[\s_\-]/g, '')))?.value ?? result.testerName ?? '';
      const definition = item.stepDefinitions?.find(step => step.id === result.stepId);
      add(item, tester, result.stepId ? { id: result.stepId, name: definition?.name || result.stepId, status: result.status, recordedAt: result.createdAt } : undefined, result.status);
    }
    for (const step of item.stepDefinitions ?? []) {
      add(item, step.executedBy ?? '', { id: step.id, name: step.name, status: step.status, recordedAt: '' }, step.status);
    }
    add(item, item.executedBy ?? '', undefined, item.status);
  }
  return [...people.values()].map(person => ({ ...person, stepCount: person.cases.reduce((sum, item) => sum + item.steps.length, 0), caseOnlyCount: person.cases.filter(item => item.caseOnly && !item.steps.length).length })).sort((a, b) => b.cases.length - a.cases.length || a.name.localeCompare(b.name));
}
