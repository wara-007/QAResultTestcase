"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { Decoration, EditorView, lineNumbers } from "@codemirror/view";
import { codeFolding, defaultHighlightStyle, foldAll, foldGutter, foldService, syntaxHighlighting, unfoldAll } from "@codemirror/language";
import { json } from "@codemirror/lang-json";
import { SearchQuery, search, setSearchQuery } from "@codemirror/search";
import { resultFoldRanges } from "@/lib/result-code";
import type { TextHighlight } from "@/lib/result-preview";

export function ResultTextViewer({ title, text, highlights = [] }: { title: string; text: string; highlights?: TextHighlight[] }) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [pretty, setPretty] = useState(false);
  const [notice, setNotice] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  const formatted = useMemo(() => { try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return null; } }, [text]);
  const content = pretty && formatted ? formatted : text;
  const lines = content.split("\n");
  const ranges = useMemo(() => resultFoldRanges(content), [content]);
  useEffect(() => {
    if (!host.current) return;
    const marks = Decoration.set((pretty ? [] : highlights).flatMap(mark => {
      const from = Math.max(0, Math.min(content.length, mark.start));
      const to = Math.max(from, Math.min(content.length, mark.end));
      if (from === to) return [];
      const style = [mark.color && `color:${mark.color}`, mark.background && `background-color:${mark.background}`, mark.bold && "font-weight:700"].filter(Boolean).join(";");
      return [Decoration.mark({ attributes: { style } }).range(from, to)];
    }), true);
    const view = new EditorView({ parent: host.current, state: EditorState.create({ doc: content, extensions: [
      EditorState.readOnly.of(true), EditorView.editable.of(false), EditorView.contentAttributes.of({ "aria-label": title }),
      lineNumbers(), EditorView.lineWrapping, codeFolding(), foldGutter(),
      foldService.of((_state, start, end) => ranges.find(range => range.from > start && range.from <= end) ?? null),
      ...(formatted ? [json(), syntaxHighlighting(defaultHighlightStyle)] : []), search(), EditorView.decorations.of(marks),
      EditorView.theme({ "&": { fontSize: "14px", backgroundColor: "#f8fafc" }, ".cm-content": { fontFamily: "ui-monospace, SFMono-Regular, monospace", overflowWrap: "anywhere" }, ".cm-gutters": { backgroundColor: "#eaf0f8", color: "#64748b", border: "none" } }),
    ] }) });
    editor.current = view;
    return () => { view.destroy(); editor.current = null; };
  }, [content, formatted, highlights, pretty, ranges, title]);
  useEffect(() => {
    const view = editor.current;
    if (!view) return;
    if (query) unfoldAll(view);
    view.dispatch({ effects: setSearchQuery.of(new SearchQuery({ search: query, literal: true, caseSensitive: false })) });
  }, [query, content, highlights]);
  return <section className={`result-text-viewer${expanded ? " result-text-expanded" : ""}`} aria-label={title}>
    <header><strong>{title}</strong><span>{lines.length} บรรทัด</span><input aria-label={`ค้นหาใน ${title}`} placeholder="ค้นหาข้อความ…" value={query} onChange={e => setQuery(e.target.value)} />{formatted && <button type="button" onClick={() => setPretty(!pretty)}>{pretty ? "ต้นฉบับพร้อม Highlight" : "จัดรูปแบบ JSON"}</button>}<button type="button" onClick={() => void navigator.clipboard.writeText(text).then(() => setNotice("คัดลอกแล้ว")).catch(() => setNotice("คัดลอกไม่ได้ กรุณาเลือกข้อความเอง"))}>คัดลอก</button><button type="button" onClick={() => setExpanded(!expanded)}>{expanded ? "ย่อกลับ" : "ขยาย"}</button></header>
    {notice && <small role="status">{notice}</small>}{pretty && highlights.length > 0 && <small>มุมมอง JSON ใช้ตำแหน่งใหม่ — เลือกต้นฉบับเพื่อดู Highlight จาก Sheets</small>}
    {ranges.length > 0 && <div className="result-fold-actions"><button type="button" onClick={() => editor.current && foldAll(editor.current)}>พับทั้งหมด</button><button type="button" onClick={() => editor.current && unfoldAll(editor.current)}>ขยายทั้งหมด</button></div>}
    <div className="result-code-editor" ref={host} />
  </section>;
}
