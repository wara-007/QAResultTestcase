import type { SupabaseClient } from '@supabase/supabase-js';

export async function updateSourceMapping(db: SupabaseClient, projectId: string, sourceId: string,
  transform: (mapping: Record<string, unknown>) => Record<string, unknown>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const source = await db.from('source_files').select('column_mapping,xmin').eq('id',sourceId).eq('project_id',projectId).single();
    if(source.error) throw new Error(source.error.message);
    const revision = String(source.data.xmin ?? '');
    if(!/^\d+$/.test(revision)) throw new Error('ไม่พบเลขรุ่นของข้อมูลนำเข้า');
    const next = transform(source.data.column_mapping ?? {});
    // xmin changes with every row update, including unrelated metadata edits.
    // Keep the large mapping in the body instead of a potentially oversized URL.
    const update = db.from('source_files').update({column_mapping:next}).eq('id',sourceId).eq('project_id',projectId).eq('xmin',revision);
    const saved = await update.select('id').maybeSingle();
    if(saved.error) throw new Error(saved.error.message);
    if(saved.data) return next;
  }
  throw new Error('ข้อมูลนำเข้าถูกอัปเดตพร้อมกัน กรุณาลองใหม่');
}
