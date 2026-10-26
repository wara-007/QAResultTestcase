import React from "react";
import { isCodeSheetField } from "../lib/sheet-sections";
import { splitHighlightedText, type TextHighlight } from "../lib/result-preview";
import { ResultTextViewer } from "./result-text-viewer";

export function ResultActualText({ text, highlights }: { text: string; highlights?: TextHighlight[] }) {
  if (!text) return null;
  if (isCodeSheetField({ ref: "", label: "", value: text })) return <ResultTextViewer title="ผลการทดสอบ / ข้อมูลเพิ่มเติม" text={text} highlights={highlights} />;
  return <p>{splitHighlightedText(text, highlights).map((part, index) => <span key={index} style={{ color: part.color, backgroundColor: part.background, fontWeight: part.bold ? 700 : undefined }}>{part.text}</span>)}</p>;
}
