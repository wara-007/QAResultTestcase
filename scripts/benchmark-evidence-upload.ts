import { performance } from "node:perf_hooks";
import { runSheetEvidenceImports } from "../src/lib/sheet-import-progress";
import { DriveEvidenceFolders } from "../src/lib/drive-evidence-folders";

async function main() {
  // Controlled transfer-only comparison. This makes no network/storage requests.
  const imageCount = 16;
  const simulatedTransferMs = 40;
  const images = Array.from({ length: imageCount }, () => ({ sheet: "large-tab" }));
  const transfer = () => new Promise<boolean>(resolve => setTimeout(() => resolve(true), simulatedTransferMs));
  const beforeStart = performance.now();
  for (const image of images) { void image; await transfer(); } // previous same-tab loop
  const beforeMs = performance.now() - beforeStart;
  let active = 0, maximum = 0;
  const afterStart = performance.now();
  await runSheetEvidenceImports(["large-tab"], images, image => image.sheet, async () => {
    active++; maximum = Math.max(maximum, active);
    try { return await transfer(); } finally { active--; }
  }, async () => {}, () => {}, () => {});
  const afterMs = performance.now() - afterStart;
  let folderCalls = 0;
  const folders = new DriveEvidenceFolders();
  await Promise.all(images.map(() => folders.resolve({ userId: "qa", projectId: "project", projectName: "Project", testCaseId: "TC_01" }, async name => { folderCalls++; return `folder-${name}`; })));
  console.log(JSON.stringify({ controlledBenchmark: true, imageCount, simulatedTransferMs,
    previousSameTabMs: Math.round(beforeMs), boundedParallelMs: Math.round(afterMs), transferSpeedup: +(beforeMs / afterMs).toFixed(2), maximumConcurrentTransfers: maximum,
    previousFolderLookups: imageCount * 3, cachedFolderLookups: folderCalls }, null, 2));
}

void main().catch(reason => { console.error(reason); process.exitCode = 1; });
