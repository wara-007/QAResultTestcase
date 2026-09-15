const MAX_IMAGE_DIMENSION = 1920;
const TARGET_IMAGE_BYTES = 1024 * 1024;
const WEBP_QUALITY_STEPS = [0.84, 0.78, 0.72, 0.66, 0.6];

const replaceExtension = (name: string, extension: string) => {
  const base = name.replace(/\.[^.]+$/, "") || "evidence";
  return `${base}.${extension}`;
};

const canvasBlob = (canvas: HTMLCanvasElement, quality: number) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error("เบราว์เซอร์ไม่สามารถบีบอัดรูปนี้ได้"));
  }, "image/webp", quality);
});

export type CompressedImage = {
  file: File;
  originalBytes: number;
  compressed: boolean;
};

/** Compress common screenshot formats before uploading. Unsupported formats keep their original file. */
export async function compressEvidenceImage(file: File): Promise<CompressedImage> {
  const originalBytes = file.size;
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
    return { file, originalBytes, compressed: false };
  }

  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return { file, originalBytes, compressed: false };
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    let bestBlob: Blob | undefined;
    for (const quality of WEBP_QUALITY_STEPS) {
      const blob = await canvasBlob(canvas, quality);
      bestBlob = blob;
      if (blob.size <= TARGET_IMAGE_BYTES) break;
    }

    if (!bestBlob || bestBlob.size >= file.size) {
      return { file, originalBytes, compressed: false };
    }

    return {
      file: new File([bestBlob], replaceExtension(file.name, "webp"), {
        type: "image/webp",
        lastModified: file.lastModified,
      }),
      originalBytes,
      compressed: true,
    };
  } catch {
    // Keep uploads usable for browser-specific formats (for example HEIC) even when Canvas cannot decode them.
    return { file, originalBytes, compressed: false };
  } finally {
    bitmap?.close();
  }
}
