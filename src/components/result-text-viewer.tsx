"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { Decoration, drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, lineNumbers } from "@codemirror/view";
import { codeFolding, foldAll, foldGutter, foldService, unfoldAll } from "@codemirror/language";
import { json } from "@codemirror/lang-json";
import { SearchQuery, search, setSearchQuery } from "@codemirror/search";
import { inspectResultJson, resultFoldRanges, resultJsonTokens } from "@/lib/result-code";
import type { TextHighlight } from "@/lib/result-preview";
import { addHighlight, clearHighlights, highlightField, highlightTargets, readHighlights } from "@/lib/result-highlights";

const EMPTY_HIGHLIGHTS: TextHighlight[] = [];

export function ResultTextViewer({ title, text, highlights = EMPTY_HIGHLIGHTS, onSave }: { title: string; text: string; highlights?: TextHighlight[]; onSave?: (text: string, highlights: TextHighlight[]) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeMark, setActiveMark] = useState(-1);
  const [markCount, setMarkCount] = useState(highlightTargets(text, highlights).length);
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [pretty, setPretty] = useState(false);
  const [notice, setNotice] = useState("");
  const [invalidJson, setInvalidJson] = useState(() => { const checked = inspectResultJson(text); return checked.isJsonLike && !checked.valid; });
  const jsonLike = useMemo(() => inspectResultJson(text).isJsonLike, [text]);
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  const formatted = useMemo(() => { try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return null; } }, [text]);
  const content = pretty && formatted ? formatted : text;
  const lines = content.split("\n");
  const ranges = useMemo(() => resultFoldRanges(content), [content]);
  useEffect(() => {
    if (!host.current) return;
    const checked = inspectResultJson(content);
    setInvalidJson(checked.isJsonLike && !checked.valid);
    const makeMarks = (values: TextHighlight[], length: number) => Decoration.set(values.flatMap(mark => {
      const from = Math.max(0, Math.min(length, mark.start));
      const to = Math.max(from, Math.min(length, mark.end));
      if (from === to) return [];
      const style = [mark.color && `color:${mark.color}`, mark.background && `background-color:${mark.background}`, mark.bold && "font-weight:700"].filter(Boolean).join(";");
      return [Decoration.mark({ attributes: { style } }).range(from, to)];
    }), true);
    const view = new EditorView({ parent: host.current, state: EditorState.create({ doc: content, extensions: [
      EditorState.readOnly.of(!editing), EditorView.editable.of(editing), EditorView.contentAttributes.of({ "aria-label": title }),
      lineNumbers(), drawSelection(), highlightActiveLine(), highlightActiveLineGutter(), EditorView.lineWrapping, codeFolding(), foldGutter(),
      foldService.of((state, start, end) => resultFoldRanges(state.doc.toString()).find(range => range.from > start && range.from <= end) ?? null),
      ...(jsonLike ? [json()] : []), search(), highlightField,
      EditorView.decorations.of(view => Decoration.set(resultJsonTokens(view.state.doc.toString(), readHighlights(view.state)).map(token => Decoration.mark({ class: `result-json-${token.kind}` }).range(token.from, token.to)), true)),
      EditorView.decorations.of(view => makeMarks(readHighlights(view.state), view.state.doc.length)),
      EditorView.updateListener.of(update => {
        if (update.docChanged) { const checked = inspectResultJson(update.state.doc.toString()); setInvalidJson(checked.isJsonLike && !checked.valid); }
        if (update.docChanged || update.transactions.some(t => t.effects.length)) {
          setMarkCount(highlightTargets(update.state.doc.toString(), readHighlights(update.state)).length);
          setActiveMark(-1);
        }
        if (update.selectionSet || update.docChanged) setActiveLine(update.state.doc.lineAt(update.state.selection.main.from).number);
      }),
      EditorView.theme({ "&": { fontSize: "14px", backgroundColor: "#f8fafc" }, ".cm-content": { fontFamily: "ui-monospace, SFMono-Regular, monospace", overflowWrap: "anywhere" }, ".cm-gutters": { backgroundColor: "#eaf0f8", color: "#64748b", border: "none" } }),
    ] }) });
    editor.current = view;
    view.dispatch({ effects: (pretty ? [] : highlights).map(mark => addHighlight.of(mark)) });
    return () => { view.destroy(); editor.current = null; };
  }, [content, formatted, jsonLike, highlights, pretty, title, editing]);
  useEffect(() => {
    const view = editor.current;
    if (!view) return;
    if (query) unfoldAll(view);
    view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: query, literal: true, caseSensitive: false })) });
  }, [query, content, highlights]);
  function jump(direction: number) {
    const view = editor.current;
    if (!view) return;
    const marks = highlightTargets(view.state.doc.toString(), readHighlights(view.state));
    if (!marks.length) return;
    const index = activeMark < 0 ? (direction > 0 ? 0 : marks.length - 1) : (activeMark + direction + marks.length) % marks.length;
    unfoldAll(view);
    view.dispatch({ selection: { anchor: marks[index].start, head: marks[index].end }, effects: EditorView.scrollIntoView(marks[index].start, { y: "center" }) });
    setActiveMark(index);
    setActiveLine(marks[index].line);
    view.focus();
  }
  async function save() {
    const view = editor.current;
    if (!view || !onSave) return;
    setSaving(true);
    try { await onSave(view.state.doc.toString(), readHighlights(view.state)); setEditing(false); setNotice("บันทึกแล้ว"); }
    catch (error) { setNotice(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ"); }
    finally { setSaving(false); }
  }
  return <section className={`result-text-viewer${expanded ? " result-text-expanded" : ""}`} aria-label={title}>
    <header><strong>{title}</strong><span>{lines.length} บรรทัด</span><input aria-label={`ค้นหาใน ${title}`} placeholder="ค้นหาข้อความ…" value={query} onChange={e => setQuery(e.target.value)} />{formatted && <button type="button" disabled={editing} onClick={() => setPretty(!pretty)}>{pretty ? "ต้นฉบับพร้อม Highlight" : "จัดรูปแบบ JSON"}</button>}<button type="button" onClick={() => void navigator.clipboard.writeText(text).then(() => setNotice("คัดลอกแล้ว")).catch(() => setNotice("คัดลอกไม่ได้ กรุณาเลือกข้อความเอง"))}>คัดลอก</button><button type="button" onClick={() => setExpanded(!expanded)}>{expanded ? "ย่อกลับ" : "ขยาย"}</button></header>
    {invalidJson && <p className="result-json-warning" role="status">JSON ไม่สมบูรณ์หรือรูปแบบไม่ถูกต้อง — แสดงข้อความต้นฉบับโดยไม่แก้ไขข้อมูล</p>}
    {notice && <small role="status">{notice}</small>}{pretty && highlights.length > 0 && <small>มุมมอง JSON ใช้ตำแหน่งใหม่ — เลือกต้นฉบับเพื่อดู Highlight จาก Sheets</small>}
    {(onSave || editing || markCount > 0) && <div className="result-fold-actions">
      {onSave && !editing && <button type="button" onClick={() => { setPretty(false); setEditing(true); setActiveMark(-1); }}>แก้ไข / Highlight</button>}
      {editing && <><button type="button" disabled={saving} onClick={() => { const view = editor.current; if (!view) return; const { from, to } = view.state.selection.main; if (from === to) return setNotice("เลือกข้อความที่ต้องการ Highlight ก่อน"); view.dispatch({ effects: addHighlight.of({ start: from, end: to, background: "#fde68a", color: "#111827" }) }); }}>Highlight ข้อความที่เลือก</button><button type="button" disabled={saving} onClick={() => editor.current?.dispatch({ effects: clearHighlights.of(null) })}>ล้าง Highlight ทั้งหมด</button><button type="button" disabled={saving} onClick={() => void save()}>{saving ? "กำลังบันทึก…" : "บันทึก"}</button><button type="button" disabled={saving} onClick={() => setEditing(false)}>ยกเลิก</button></>}
      {markCount > 0 && <><button type="button" disabled={pretty} onClick={() => jump(-1)}>◀ ก่อนหน้า</button><span aria-live="polite">Highlight {Math.min(activeMark + 1, markCount)}/{markCount}{activeLine !== null ? ` · บรรทัด ${activeLine}` : ""}</span><button type="button" disabled={pretty} onClick={() => jump(1)}>ถัดไป ▶</button></>}
    </div>}
    {ranges.length > 0 && <div className="result-fold-actions"><button type="button" onClick={() => editor.current && foldAll(editor.current)}>พับทั้งหมด</button><button type="button" onClick={() => editor.current && unfoldAll(editor.current)}>ขยายทั้งหมด</button></div>}
    <div className="result-code-editor" ref={host} />
  </section>;
}
