const projectWorkbooks = new Map<string, Promise<ArrayBuffer>>();

export function getProjectWorkbook(projectId: string, loader: () => Promise<ArrayBuffer>) {
  const cached = projectWorkbooks.get(projectId);
  if (cached) return cached;
  const pending = loader().catch((error) => {
    if (projectWorkbooks.get(projectId) === pending) projectWorkbooks.delete(projectId);
    throw error;
  });
  projectWorkbooks.set(projectId, pending);
  return pending;
}

export function clearProjectWorkbook(projectId: string) {
  projectWorkbooks.delete(projectId);
}
