"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Play, X, ZoomIn } from "lucide-react";
import { useEffect, useState } from "react";

export type ViewerImage = {
  id: string;
  name: string;
  url: string;
  mimeType?: string;
};

export function ImageViewerGallery({ images, className = "drive-evidence-gallery" }: { images: ViewerImage[]; className?: string }) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  useEffect(() => {
    if (previewIndex == null) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewIndex(null);
      if (event.key === "ArrowLeft") setPreviewIndex((current) => current == null ? null : (current - 1 + images.length) % images.length);
      if (event.key === "ArrowRight") setPreviewIndex((current) => current == null ? null : (current + 1) % images.length);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [images.length, previewIndex]);

  if (!images.length) return null;
  const preview = previewIndex == null ? null : images[previewIndex];
  return <>
    <div className={className}>{images.map((item, index) => <button type="button" onClick={() => setPreviewIndex(index)} aria-label={`ดู${item.mimeType?.startsWith("video/") ? "วิดีโอ" : "รูป"} ${item.name}`} key={item.id}>
      {item.mimeType?.startsWith("video/") ? <video src={item.url} preload="metadata" muted playsInline aria-label={item.name} /> : <Image src={item.url} alt={item.name} width={900} height={600} sizes="(max-width: 700px) 50vw, 360px" unoptimized />}
      <span>{item.mimeType?.startsWith("video/") ? <Play size={17} /> : <ZoomIn size={17} />}{item.name}</span>
    </button>)}</div>
    {preview && previewIndex != null && <div className="review-image-backdrop" role="presentation" onMouseDown={() => setPreviewIndex(null)}>
      <section className="review-image-dialog" role="dialog" aria-modal="true" aria-label={`ตัวอย่างรูป ${preview.name}`} onMouseDown={(event) => event.stopPropagation()}>
        <header><strong>{preview.name} · {previewIndex + 1}/{images.length}</strong><button type="button" onClick={() => setPreviewIndex(null)} aria-label="ปิดตัวอย่างรูป"><X size={21} /></button></header>
        <div className="review-image-stage">
          {preview.mimeType?.startsWith("video/") ? <video key={preview.url} src={preview.url} controls playsInline preload="metadata" aria-label={preview.name} /> : <Image src={preview.url} alt={preview.name} fill sizes="95vw" unoptimized />}
          {images.length > 1 ? <><button type="button" className="image-viewer-nav previous" onClick={() => setPreviewIndex((previewIndex - 1 + images.length) % images.length)} aria-label="รูปก่อนหน้า"><ChevronLeft size={28} /></button><button type="button" className="image-viewer-nav next" onClick={() => setPreviewIndex((previewIndex + 1) % images.length)} aria-label="รูปถัดไป"><ChevronRight size={28} /></button></> : null}
        </div>
      </section>
    </div>}
  </>;
}
