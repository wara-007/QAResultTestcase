// Publish the database snapshot independently of slower optional requests.
export function workspaceReadyFirst<T, R extends unknown[]>(
  workspace: Promise<T>,
  publish: (value: T) => void,
  background: { [K in keyof R]: Promise<R[K]> },
) {
  const ready = workspace.then(value => { publish(value); return value; });
  return Promise.allSettled([ready, ...background] as const);
}

export function shouldFetchGoogleWorkspace(hasSavedData: boolean, needsDetails: boolean, detailsLoaded: boolean, needsRefresh: boolean): boolean {
  if (!needsDetails) return !hasSavedData;
  return !detailsLoaded || needsRefresh;
}
