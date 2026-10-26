import type { TestCase } from './types';

export type RegisterCaseIdentity = { sourceId: string; scope: string; fingerprint: string; occurrence: number };
export const displayTestCaseId = (item: { id: string; registerIdentity?: RegisterCaseIdentity }) => item.registerIdentity?.sourceId ?? item.id;
const key = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const hash = (value: string) => {
  let result = 0xcbf29ce484222325n;
  for (const character of value) result = BigInt.asUintN(64, (result ^ BigInt(character.codePointAt(0)!)) * 0x100000001b3n);
  return result.toString(36);
};
const identityKey = (identity: RegisterCaseIdentity) => JSON.stringify([identity.sourceId, identity.fingerprint, identity.occurrence]);
const definitionKey = (identity: RegisterCaseIdentity) => JSON.stringify([identity.sourceId, identity.fingerprint]);
const referenceKey = (item: TestCase) => {
  const targets = [...new Set(item.resultReferenceTargets?.filter(Boolean) ?? [])].sort();
  return targets.length ? JSON.stringify(['targets', targets]) : item.resultReference.trim() ? JSON.stringify(['raw', item.resultReference.trim()]) : undefined;
};
const rowId = (identity: RegisterCaseIdentity) => `qa-row:${hash(identity.sourceId)}:${identity.fingerprint}:${identity.occurrence}`;

/** A register row owns its identity; Ref and execution edits do not change it. */
export function assignRegisterCaseIdentities(cases: readonly TestCase[]): TestCase[] {
  const counts = new Map<string, number>();
  cases.forEach(item => counts.set(displayTestCaseId(item), (counts.get(displayTestCaseId(item)) ?? 0) + 1));
  const occurrences = new Map<string, number>();
  const remaining = new Map(counts);
  let scope = '';
  const used = new Set(cases.map(displayTestCaseId));
  return cases.map(item => {
    if (item.sourceSheetName || item.sourceRow <= 0) return item;
    const sourceId = displayTestCaseId(item);
    const scopeField = item.sourceFields?.find(field => ['testscenarioid', 'scenarioid'].includes(key(field.label)));
    if (scopeField?.value.trim()) scope = scopeField.value.trim();
    const definition = item.sourceFields?.filter(field =>
      /^(?:testscenarioid|scenarioid|testscenario|scenario|testcase|testcasename|casename|condition|teststepdescription|teststep|steps|expectedresult|expected|positivenegativecase|platform|testdata|datatest)$/.test(key(field.label))
    ).map(field => [key(field.label), field.value.trim()]);
    const fingerprint = hash(JSON.stringify([scope, definition?.length ? definition : [item.name, item.scenario, item.condition, item.steps, item.expected], (item.stepDefinitions ?? []).map(step => [step.name, step.description, step.expected, step.classification])]));
    const occurrenceKey = JSON.stringify([sourceId, fingerprint]);
    const occurrence = (occurrences.get(occurrenceKey) ?? 0) + 1;
    occurrences.set(occurrenceKey, occurrence);
    const registerIdentity = item.registerIdentity ?? { sourceId, scope, fingerprint, occurrence };
    const left = (remaining.get(sourceId) ?? 1) - 1;
    remaining.set(sourceId, left);
    let id = item.registerIdentity ? item.id : left === 0 ? sourceId : rowId(registerIdentity);
    while (id !== sourceId && used.has(id)) id += '-row';
    used.add(id);
    return { ...item, id, registerIdentity };
  });
}

/** Match persisted rows before allocating new keys, preserving existing case URLs. */
export function alignRegisterCaseIdentities(local: readonly TestCase[], incoming: readonly TestCase[]): TestCase[] {
  const remote = assignRegisterCaseIdentities(incoming);
  const identifiedLocal = assignRegisterCaseIdentities(local);
  const matched: (string | undefined)[] = remote.map(() => undefined);
  const taken = new Set<string>();
  // A distinct unchanged definition is stronger evidence than an editable Ref.
  // Reserve it before references can claim the same persisted row.
  const definitionGroups = (items: readonly TestCase[]) => {
    const groups = new Map<string, TestCase[]>();
    for (const item of items) {
      if (!item.registerIdentity) continue;
      const group = definitionKey(item.registerIdentity);
      const rows = groups.get(group) ?? [];
      rows.push(item);
      groups.set(group, rows);
    }
    return groups;
  };
  const localDefinitions = definitionGroups(identifiedLocal);
  const remoteDefinitions = definitionGroups(remote);
  remote.forEach((item, index) => {
    if (!item.registerIdentity) return;
    const group = definitionKey(item.registerIdentity);
    const candidates = localDefinitions.get(group);
    if (candidates?.length === 1 && remoteDefinitions.get(group)?.length === 1 && !taken.has(candidates[0].id)) {
      matched[index] = candidates[0].id;
      taken.add(candidates[0].id);
    }
  });
  // Ref is a tie-breaker, not part of the identity: reserve distinct unchanged
  // references before occurrence matching can give their IDs to another row.
  const referenceGroups = (items: readonly TestCase[]) => {
    const groups = new Map<string, TestCase[]>();
    for (const item of items) {
      const reference = referenceKey(item);
      if (!item.registerIdentity || !reference) continue;
      const group = JSON.stringify([item.registerIdentity.sourceId, reference]);
      const rows = groups.get(group) ?? [];
      rows.push(item);
      groups.set(group, rows);
    }
    return groups;
  };
  const localReferences = referenceGroups(identifiedLocal);
  const remoteReferences = referenceGroups(remote);
  remote.forEach((item, index) => {
    if (matched[index]) return;
    const reference = referenceKey(item);
    if (!item.registerIdentity || !reference) return;
    const group = JSON.stringify([item.registerIdentity.sourceId, reference]);
    const candidates = localReferences.get(group);
    if (candidates?.length === 1 && remoteReferences.get(group)?.length === 1 && !taken.has(candidates[0].id)) {
      matched[index] = candidates[0].id;
      taken.add(candidates[0].id);
    }
  });
  const byIdentity = new Map(identifiedLocal.filter(item => item.registerIdentity).map(item => [identityKey(item.registerIdentity!), item.id]));
  remote.forEach((item, index) => {
    if (matched[index] || !item.registerIdentity) return;
    const id = byIdentity.get(identityKey(item.registerIdentity));
    if (id && !taken.has(id)) { matched[index] = id; taken.add(id); }
  });
  remote.forEach((item, index) => {
    if (matched[index]) return;
    const sourceId = displayTestCaseId(item);
    const candidates = identifiedLocal.filter(saved => !taken.has(saved.id) && displayTestCaseId(saved) === sourceId);
    const sameDefinition = candidates.filter(saved => saved.registerIdentity && item.registerIdentity && definitionKey(saved.registerIdentity) === definitionKey(item.registerIdentity));
    const sameRow = candidates.find(saved => saved.sourceRow === item.sourceRow);
    const fallback = sameDefinition.length === 1 ? sameDefinition[0] : remote.filter(row => displayTestCaseId(row) === sourceId).length === 1 && candidates.length === 1 ? candidates[0] : sameRow;
    if (fallback) { matched[index] = fallback.id; taken.add(fallback.id); }
  });
  const reserved = new Set([...local.map(item => item.id), ...matched.filter((id): id is string => !!id)]);
  const used = new Set<string>();
  const stableOccurrences = new Map<number, number>();
  const usedOccurrences = new Map<string, Set<number>>();
  remote.forEach((item, index) => {
    const saved = identifiedLocal.find(row => row.id === matched[index]);
    if (!saved?.registerIdentity || !item.registerIdentity || definitionKey(saved.registerIdentity) !== definitionKey(item.registerIdentity)) return;
    const group = definitionKey(item.registerIdentity);
    const occurrences = usedOccurrences.get(group) ?? new Set<number>();
    if (!occurrences.has(saved.registerIdentity.occurrence)) {
      stableOccurrences.set(index, saved.registerIdentity.occurrence);
      occurrences.add(saved.registerIdentity.occurrence);
      usedOccurrences.set(group, occurrences);
    }
  });
  return remote.map((item, index) => {
    let id = matched[index] ?? item.id;
    if ((!matched[index] && reserved.has(id)) || used.has(id)) {
      id = item.registerIdentity ? rowId(item.registerIdentity) : id;
      while (reserved.has(id) || used.has(id)) id += '-row';
    }
    used.add(id);
    let registerIdentity = item.registerIdentity;
    if (registerIdentity) {
      const group = definitionKey(registerIdentity);
      const occurrences = usedOccurrences.get(group) ?? new Set<number>();
      let occurrence = stableOccurrences.get(index);
      if (occurrence === undefined) {
        occurrence = registerIdentity.occurrence;
        while (occurrences.has(occurrence)) occurrence++;
        occurrences.add(occurrence);
        usedOccurrences.set(group, occurrences);
      }
      registerIdentity = { ...registerIdentity, occurrence };
    }
    return { ...item, id, registerIdentity };
  });
}
