"use client";

import { ArrowDownToLine, LoaderCircle, RefreshCw, Upload } from "lucide-react";
import { GoogleDrivePickerButton } from "./google-drive-picker-button";

type ProjectFileActionsProps = {
  page: string;
  detail?: boolean;
  projectId: string;
  googleSheetId: string;
  hasSource: boolean;
  canEdit: boolean;
  canManage: boolean;
  pulling: boolean;
  syncing: boolean;
  exporting: boolean;
  onUpload: () => void;
  onPull: () => void | Promise<void>;
  onSync: () => void | Promise<void>;
  onDownload: () => void | Promise<void>;
};

export function ProjectFileActions(props: ProjectFileActionsProps) {
  if (props.page !== "files" || props.detail) return null;
  return <div className="project-file-actions">
    <section className="panel project-file-action-card" aria-label="ไฟล์ต้นฉบับ">
      <h2>ไฟล์ต้นฉบับ</h2>
      <p>จัดการไฟล์ Excel หรือเลือกไฟล์จาก Google Drive เพื่อโหลดข้อมูลของ Project</p>
      <div className="project-file-action-buttons">
        {props.canEdit && <button type="button" className="secondary-button" onClick={props.onUpload}><Upload size={17} />อัปโหลด Excel</button>}
        {props.canEdit && props.googleSheetId && <GoogleDrivePickerButton projectId={props.projectId} expectedFileId={props.googleSheetId} disabled={props.pulling || props.syncing} onPicked={async () => { await props.onPull(); }} />}
        {(props.googleSheetId ? props.canEdit : props.canManage) && <button type="button" className="secondary-button" onClick={() => void props.onPull()} disabled={props.pulling}>{props.pulling ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />}{props.googleSheetId ? "โหลดจาก Sheets" : "เชื่อม Google Sheet"}</button>}
      </div>
    </section>
    <section className="panel project-file-action-card" aria-label="ส่งออกผลทดสอบ">
      <h2>ส่งออกผลทดสอบ</h2>
      <p>ซิงค์ผลกลับ Google Sheets หรือดาวน์โหลดไฟล์ผลการทดสอบ</p>
      <div className="project-file-action-buttons">
        {props.canEdit && props.googleSheetId && <button type="button" className="sync-button" onClick={() => void props.onSync()} disabled={props.syncing}>{props.syncing ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />}ซิงค์กลับ Google Sheets</button>}
        {props.hasSource && <button type="button" className="primary-button" onClick={() => void props.onDownload()} disabled={props.exporting}>{props.exporting ? <LoaderCircle className="spin" size={17} /> : <ArrowDownToLine size={17} />}ดาวน์โหลด Result</button>}
      </div>
      {!props.hasSource && !props.googleSheetId && <p>เพิ่มไฟล์ต้นฉบับก่อนส่งออกผลทดสอบ</p>}
    </section>
  </div>;
}
