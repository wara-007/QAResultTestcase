import type { WorkbookSource } from './types';

// Sheets bytes are transient. Source versions retain the mapping/checkpoint,
// while local uploads still need a durable original because there is no URL.
export async function storeSourceWorkbook(source: WorkbookSource, projectId: string, sourceId: string, spreadsheetId: string,
 upload: (key: string, buffer: ArrayBuffer) => Promise<number>, origin: "upload" | "google-sheets" = "upload") {
 if (origin === "google-sheets" && spreadsheetId) return {sourceOrigin:origin,storageKey:'',storageProvider:'local' as const,byteSize:0,chunkCount:0,workbookStorage:'google-sheets' as const};
 const safeName=source.fileName.replace(/[^a-zA-Z0-9._-]+/g,'_');
 const storageKey=`${projectId}/${sourceId}/${safeName}`;
 const chunkCount=await upload(storageKey,source.buffer);
 return {sourceOrigin:origin,storageKey,storageProvider:'supabase' as const,byteSize:source.buffer.byteLength,chunkCount,workbookStorage:'supabase' as const};
}

export async function loadSourceWorkbookBytes({mapping,includeWorkbook,readStored,readSheets}:{mapping:Record<string,unknown>;includeWorkbook:boolean;readStored:()=>Promise<ArrayBuffer>;readSheets:()=>Promise<ArrayBuffer>}) {
 if (!includeWorkbook) return new ArrayBuffer(0);
 return mapping.workbookStorage==='google-sheets' ? readSheets() : readStored();
}

export function canRenderStoredCaseDetails(source: WorkbookSource|null, hasStoredCase: boolean) {
 return !!(hasStoredCase && source?.workbookStorage==='google-sheets' && source.sheetImport?.complete && !source.sheetImport.refreshRequired);
}
