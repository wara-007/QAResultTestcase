/** The register explicitly recorded Skip without naming a tester. */
export function isUnnamedSheetSkip(steps: { status: string; executedBy: string }[] | undefined, results: { source?: string; editedLocally?: boolean }[] = []) {
  return !!steps?.length && steps.every(step => step.status === "Skip" && !step.executedBy?.trim()) && !results.some(result => result.source === "web" || result.editedLocally);
}
