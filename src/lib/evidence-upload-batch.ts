/** One import owns this map; a later retry starts a fresh batch. */
export function evidenceUploadBatch() {
  const uploads = new Map<string, Promise<boolean>>();
  return (key: string, transfer: () => Promise<boolean>) => {
    let pending = uploads.get(key);
    if (!pending) {
      pending = Promise.resolve().then(transfer);
      uploads.set(key, pending);
    }
    return pending;
  };
}

/** Share a physical file upload while each case retains its own proof reference. */
export function sharedEvidenceFiles<T>() {
  const files = new Map<string, Promise<T | null>>();
  return (key: string, transfer: () => Promise<T | null>) => {
    let pending = files.get(key);
    if (!pending) {
      pending = Promise.resolve().then(transfer).then(value => { if (value === null) files.delete(key); return value; }, error => { files.delete(key); throw error; });
      files.set(key, pending);
    }
    return pending;
  };
}
