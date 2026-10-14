"use client";
import { useState } from 'react';
import { Columns3, Filter, Plus, RotateCcw, X } from 'lucide-react';
import { CASE_ADVANCED_FILTERS_ENABLED, visibleCaseColumns, type CaseColumn, type CaseTableView } from '@/lib/case-table-view';

export function CaseTableTools({columns,view,onChange}:{columns:CaseColumn[];view:CaseTableView;onChange:(changes:Partial<CaseTableView>)=>void}) {
  const [columnSearch,setColumnSearch]=useState('');
  const selected=visibleCaseColumns(columns,view.selected).map(column=>column.key);
  const filterColumns=columns.filter(column=>column.key!=='sheetLoad');
  function updateFilter(index:number,change:Partial<CaseTableView['filters'][number]>) {
    onChange({filters:view.filters.map((filter,i)=>i===index?{...filter,...change}:filter)});
  }
  return <div className="case-table-tools">
    <details className="case-column-picker"><summary><Columns3 size={16}/>เลือกคอลัมน์ <span>{selected.length}/6</span></summary><div className="case-column-options">
      <p>เลือกได้สูงสุด 6 คอลัมน์ · Test Case ID แสดงเสมอ</p>
      <input aria-label="ค้นหาคอลัมน์" placeholder="ค้นหาชื่อคอลัมน์…" value={columnSearch} onChange={event=>setColumnSearch(event.target.value)}/>
      <div className="case-column-list">{columns.filter(column=>column.label.toLocaleLowerCase().includes(columnSearch.toLocaleLowerCase())).map(column=><label key={column.key}>
        <input type="checkbox" checked={selected.includes(column.key)} disabled={column.key==='id' || (!selected.includes(column.key) && selected.length>=6)} onChange={event=>onChange({selected:event.target.checked?[...selected,column.key]:selected.filter(key=>key!==column.key)})}/>
        <span>{column.label}{columns.filter(c=>c.label===column.label).length>1 && <small>คอลัมน์ {(column.column ?? 0)+1}</small>}</span>{column.key==='id' && <small>ล็อกไว้</small>}
      </label>)}</div>
      <button type="button" className="secondary-button" onClick={()=>onChange({selected:null})}><RotateCcw size={14}/>คอลัมน์เริ่มต้น</button>
    </div></details>
    {CASE_ADVANCED_FILTERS_ENABLED && <details className="case-filter-picker"><summary><Filter size={16}/>ตัวกรองเพิ่มเติม <span>{view.filters.length}</span></summary><div className="case-filter-options">
      <p>ทุกเงื่อนไขต้องตรงกัน · กรองคอลัมน์ที่ซ่อนไว้ได้</p>
      {view.filters.map((filter,index)=><div className="case-filter-row" key={index}>
        <select aria-label={`คอลัมน์ตัวกรอง ${index+1}`} value={filter.column} onChange={event=>updateFilter(index,{column:event.target.value})}>
          {!filterColumns.some(column=>column.key===filter.column) && <option value={filter.column}>ยังไม่พบคอลัมน์เดิม · รอโหลดข้อมูล</option>}
          {filterColumns.map(column=><option key={column.key} value={column.key}>{column.label}{filterColumns.filter(c=>c.label===column.label).length>1?` (คอลัมน์ ${(column.column ?? 0)+1})`:''}</option>)}
        </select>
        <select aria-label={`เงื่อนไขตัวกรอง ${index+1}`} value={filter.operator} onChange={event=>updateFilter(index,{operator:event.target.value as typeof filter.operator})}>
          <option value="contains">มีข้อความ</option><option value="equals">ตรงกับ</option><option value="empty">ว่าง</option><option value="not-empty">ไม่ว่าง</option>
        </select>
        {filter.operator==='contains' || filter.operator==='equals' ? <input aria-label={`ค่าตัวกรอง ${index+1}`} placeholder="ค่าที่ต้องการกรอง" maxLength={500} value={filter.value} onChange={event=>updateFilter(index,{value:event.target.value})}/> : <span/>}
        <button type="button" className="icon-button" aria-label={`ลบตัวกรอง ${index+1}`} onClick={()=>onChange({filters:view.filters.filter((_,i)=>i!==index)})}><X size={16}/></button>
      </div>)}
      <button type="button" className="secondary-button" disabled={!filterColumns.length || view.filters.length>=20} onClick={()=>onChange({filters:[...view.filters,{column:filterColumns[0].key,operator:'contains',value:''}]})}><Plus size={14}/>เพิ่มเงื่อนไข</button>
    </div></details>}
    {(view.query || view.status!=='All' || (CASE_ADVANCED_FILTERS_ENABLED && view.filters.length>0)) && <button type="button" className="secondary-button" onClick={()=>onChange({query:'',status:'All',filters:[]})}><X size={14}/>ล้างตัวกรอง</button>}
    <small>มี {columns.length} คอลัมน์ให้เลือก · การซ่อนคอลัมน์ไม่ลบข้อมูล</small>
  </div>;
}
