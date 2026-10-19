export const SPRINT_SORT_OPTIONS = [
  { value: 'created-desc', label: 'สร้างล่าสุด' },
  { value: 'created-asc', label: 'สร้างเก่าสุด' },
  { value: 'start-desc', label: 'วันที่เริ่ม Sprint · ใหม่สุดก่อน' },
  { value: 'start-asc', label: 'วันที่เริ่ม Sprint · เก่าสุดก่อน' },
  { value: 'name-asc', label: 'ชื่อ Sprint · น้อยไปมาก' },
  { value: 'name-desc', label: 'ชื่อ Sprint · มากไปน้อย' },
] as const;

export type SprintSort = typeof SPRINT_SORT_OPTIONS[number]['value'];

export function parseSprintSort(value: string | null): SprintSort {
  return SPRINT_SORT_OPTIONS.find(option => option.value === value)?.value ?? 'created-desc';
}

/** Planning supplies rows in created_at descending order; do not use updated_at. */
export function sortSprints<T extends { name: string; startDate: string }>(sprints: readonly T[], sort: SprintSort): T[] {
  const result = [...sprints];
  if (sort === 'created-desc') return result;
  if (sort === 'created-asc') return result.reverse();
  if (sort === 'name-asc' || sort === 'name-desc') {
    const collator = new Intl.Collator('th', { numeric: true, sensitivity: 'base' });
    return result.sort((a, b) => collator.compare(a.name, b.name) * (sort === 'name-desc' ? -1 : 1));
  }
  return result.sort((a, b) => {
    const left = Date.parse(a.startDate), right = Date.parse(b.startDate);
    if (!Number.isFinite(left)) return Number.isFinite(right) ? 1 : 0;
    if (!Number.isFinite(right)) return -1;
    return (left - right) * (sort === 'start-desc' ? -1 : 1);
  });
}
