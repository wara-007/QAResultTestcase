"use client";

import { useEffect, useRef, useState } from "react";
import { FolderOpen, LoaderCircle } from "lucide-react";
import type { PickedWorkbook } from "@/lib/google-picker";
import { googleAuthorizationTarget } from "@/lib/google-authorization";

export function GoogleDrivePickerButton({ projectId, expectedFileId, onPicked, onAuthorizationRequired, disabled = false }: { projectId?: string; expectedFileId?: string; onPicked: (file: PickedWorkbook) => void | Promise<void>; onAuthorizationRequired?: (authUrl: string) => void; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [authUrl, setAuthUrl] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function open() {
    if (controller.current) return;
    const active = new AbortController();
    controller.current = active;
    setBusy(true); setError(""); setAuthUrl("");
    try {
      const response = await fetch("/api/google/picker", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId }), cache: "no-store", signal: active.signal });
      const data = await response.json();
      if (!response.ok) {
        if (typeof data.authUrl === "string" && data.authUrl.startsWith("/api/google/auth/start?")) {
          setAuthUrl(data.authUrl);
          if (onAuthorizationRequired) onAuthorizationRequired(data.authUrl);
          else {
            const target = googleAuthorizationTarget(data.authUrl, window.location.origin, `${window.location.pathname}${window.location.search}${window.location.hash}`);
            if (target) window.location.assign(target);
          }
        }
        throw new Error(data.error ?? "เปิด Google Drive ไม่สำเร็จ");
      }
      // Download the Google SDK only after QA clicks the button.
      const { selectDriveWorkbook } = await import("@/lib/google-picker-client");
      const file = await selectDriveWorkbook(data, { expectedFileId, signal: active.signal });
      if (file && !active.signal.aborted) await onPicked(file);
    } catch (reason) {
      if (!active.signal.aborted) setError(reason instanceof Error ? reason.message : "เลือกไฟล์ไม่สำเร็จ");
    } finally {
      if (!active.signal.aborted) setBusy(false);
      controller.current = null;
    }
  }
  return <div className="drive-picker-control">
    <button type="button" className="secondary-button" disabled={disabled || busy} onClick={() => void open()}>{busy ? <LoaderCircle className="spin" size={17} /> : <FolderOpen size={17} />}{busy ? "กำลังเลือกไฟล์…" : "เลือกไฟล์จาก Google Drive"}</button>
    {error && <p className="form-error" role="alert">{error}</p>}
    {authUrl && <a href={authUrl}>เชื่อม Google เพื่อเลือกไฟล์</a>}
  </div>;
}
