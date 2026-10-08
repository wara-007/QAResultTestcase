import React from "react";
import type { TestResult } from "../lib/types";

export function SharedSheetDefinition({ caseId, sheetName, caseIds, table }: {
  caseId: string; sheetName: string; caseIds: string[]; table?: TestResult["sheetDefinitionTable"];
}) {
  return <section className="shared-sheet-definition" aria-label={`ตารางต้นฉบับจาก ${sheetName}`}>
    <div className="shared-sheet-notice"><span>กำลังดู <strong>{caseId}</strong></span><strong>ผลร่วมของ {caseIds.join(", ")}</strong><span>แท็บต้นทาง: {sheetName}</span><small>ตารางและ Results ด้านล่างมาจากแท็บรวม · สถานะของแต่ละ Test case ยังแยกกัน</small></div>
    <h3>ตาราง Test cases จาก Sheets</h3>
    {table ? <div className="shared-sheet-table"><table><thead><tr>{table.headers.map((header, index) => <th key={index}>{header || `คอลัมน์ ${index + 1}`}</th>)}</tr></thead><tbody>{table.rows.map((row, index) => <tr key={index}>{row.map((value, column) => <td key={column}>{value || "—"}</td>)}</tr>)}</tbody></table></div> : <p className="muted">ไม่พบตารางด้านบนในแท็บนี้</p>}
  </section>;
}
