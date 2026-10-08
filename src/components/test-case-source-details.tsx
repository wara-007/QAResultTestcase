import React from "react";
import type { TestCase } from "../lib/types";
export function TestCaseSourceDetails({ testCase }: { testCase: TestCase }) {
  const fallback = testCase.stepDefinitions?.length
    ? (testCase.stepDefinitions[0].sourceFields ?? []).filter(field => /^(testscenario|testscenariodescriptionhighleveltestcase|testcasetcid|testcasename|condition)$/u.test(field.label.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")))
    : ([['scenario', 'Test Scenario'], ['condition', 'Condition'], ['steps', 'Test Step Description'], ['expected', 'Expected Result']] as const)
      .filter(([field]) => testCase[field].trim()).map(([field, label], index) => ({ field, label, column: -100 - index, value: testCase[field] }));
  const fields = testCase.sourceFields ?? fallback;
  const extras = (testCase.customFields ?? []).filter(field => field.source === "testcase" && !fields.some(source => source.column === field.column));
  if (!fields.length && !extras.length) return null;
  return <section className="readonly-block testcase-source-details"><dl className="sheet-result-fields">
    {fields.map(source => {
      const property = "field" in source ? source.field : undefined;
      const edited = property ? testCase[property] : undefined;
      const custom = (testCase.customFields ?? []).find(field => field.source === "testcase" && field.column === source.column);
      const value = typeof edited === "string" ? edited : custom?.value ?? source.value;
      return <div key={source.column}><dt>{source.label}</dt><dd className="multiline">{value.trim() || "—"}</dd></div>;
    })}
    {extras.map(field => <div key={field.key}><dt>{field.label}</dt><dd className="multiline">{field.value.trim() || "—"}</dd></div>)}
  </dl></section>;
}
