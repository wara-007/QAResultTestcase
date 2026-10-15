"use client";
import { Fragment, type ReactNode } from 'react';
import { ChevronRight, Eye, FileSpreadsheet, LoaderCircle, Search, Upload } from 'lucide-react';
import { caseColumnValue, caseRegisterIdLabel, type CaseColumn } from '@/lib/case-table-view';
import { testCaseSourceSection } from '@/lib/testcase-rows';
import type { RowLoadState } from '@/lib/result-preview';
import type { TestCase, TestStatus } from '@/lib/types';

export type CaseRegisterRow={item:TestCase;sheetAlias:string};
export function CaseRegisterTable({rows,columns,getRowState,getRowLoadLabel,assigneeNames,associatedSheetNames,onOpen,onPreview,onRetry,editingAssignments,isSelected,onToggle,renderStatus,hasCases,onUpload,loading=false}:{
  rows:CaseRegisterRow[];columns:CaseColumn[];getRowState:(row:CaseRegisterRow)=>RowLoadState|'idle';
  getRowLoadLabel:(row:CaseRegisterRow)=>string;
  assigneeNames:(item:TestCase,alias:string)=>string;onOpen:(row:CaseRegisterRow)=>void;onRetry:(row:CaseRegisterRow)=>void;
  associatedSheetNames:(item:TestCase)=>string[];
  onPreview?:(row:CaseRegisterRow)=>void;
  editingAssignments:boolean;isSelected:(row:CaseRegisterRow)=>boolean;onToggle:(row:CaseRegisterRow,selected:boolean)=>void;
  renderStatus:(status:TestStatus)=>ReactNode;hasCases:boolean;onUpload:()=>void;loading?:boolean;
}) {
  const span=columns.length+1+(editingAssignments?1:0);
  return <div className="table-wrap case-register-table" aria-busy={loading}><table><colgroup>{editingAssignments && <col style={{width:40}}/>}{columns.map(column=><col key={column.key} style={{width:column.field==='id'?'26%':undefined}}/>)}<col style={{width:onPreview?144:52}}/></colgroup>
    <thead><tr>{editingAssignments && <th aria-label="เลือกเคสเพื่อมอบหมาย"/>}{columns.map(column=><th key={column.key}>{column.label}</th>)}<th aria-label="เปิดรายละเอียด"/></tr></thead>
    <tbody>{loading && !rows.length ? Array.from({length:5},(_,index)=><tr key={index} className="case-register-skeleton" aria-hidden="true">{Array.from({length:span},(_,column)=><td key={column}><span/><span/></td>)}</tr>) : rows.map((row,index)=>{
      const {item,sheetAlias}=row;
      const idLabel=caseRegisterIdLabel(item.id,sheetAlias,associatedSheetNames(item));
      const rowState=getRowState(row);
      const section=testCaseSourceSection(item);
      return <Fragment key={`${item.id}:${sheetAlias || 'testcase'}`}>
        {section && section!==(index?testCaseSourceSection(rows[index-1].item):'') && <tr className="testcase-section-row"><td colSpan={span}>{section}</td></tr>}
        <tr onClick={()=>onOpen(row)}>{editingAssignments && <td onClick={event=>event.stopPropagation()}><input type="checkbox" aria-label={`เลือก ${item.id}${sheetAlias?` (${sheetAlias})`:''} เพื่อมอบหมาย`} checked={isSelected(row)} onChange={event=>onToggle(row,event.target.checked)}/></td>}
          {columns.map(column=>{
            const value=caseColumnValue(item,column);
            return <td key={column.key} data-label={column.label}>
              {column.field==='id' ? <><button type="button" className="case-table-id-link" onClick={event=>{event.stopPropagation();onOpen(row);}}>{idLabel}</button><strong className="case-cell-name">{item.name || 'ไม่มีชื่อ Testcase'}</strong></>
              :column.key==='sheetLoad'?<><span className={`sheet-row-state sheet-row-${rowState}`}>{rowState==='loading' && <LoaderCircle className="spin" size={14}/>}<span>{getRowLoadLabel(row)}</span></span>{rowState==='error' && <button type="button" className="row-retry" onClick={event=>{event.stopPropagation();onRetry(row);}}>ลองใหม่</button>}</>
              :column.field==='status'?renderStatus(item.status)
              :<>{value.length>160?<details className="case-cell-full" onClick={event=>event.stopPropagation()}><summary>{value.slice(0,160)}… <span>ดูเต็ม</span></summary><div>{value}</div></details>:<span className="case-cell-text">{value || '—'}</span>}{column.field==='executedBy' && assigneeNames(item,sheetAlias) && <small className="case-assignees">รับผิดชอบ: {assigneeNames(item,sheetAlias)}</small>}</>}
            </td>;
          })}
          <td><div className="case-register-actions">{onPreview && <button type="button" className="case-preview-button" aria-label={`Preview ${item.id}${sheetAlias?` ${sheetAlias}`:''}`} onClick={event=>{event.stopPropagation();onPreview(row);}}><Eye size={15}/>Preview</button>}<button type="button" className="icon-button" aria-label={`เปิด ${item.id}${sheetAlias?` ${sheetAlias}`:''}`} onClick={event=>{event.stopPropagation();onOpen(row);}}><ChevronRight size={18}/></button></div></td>
        </tr>
      </Fragment>;
    })}</tbody></table>
    {loading && <span className="sr-only" role="status">กำลังโหลด Test cases</span>}
    {!loading && !rows.length && <div className="empty-state">{hasCases?<Search size={26}/>:<FileSpreadsheet size={26}/>}<strong>{hasCases?'ไม่พบ Testcase':'ยังไม่มี Testcase'}</strong><span>{hasCases?'ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง':'ข้อมูลจะแสดงหลังจากอัปโหลดไฟล์ Excel หรือโหลดจาก Sheets'}</span>{!hasCases && <button type="button" className="secondary-button" onClick={onUpload}><Upload size={16}/>อัปโหลดไฟล์</button>}</div>}
  </div>;
}
