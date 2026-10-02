import type { CompressedImage } from "./image-compression";

/** Re-encode short evidence clips locally. Unsupported codecs/browsers retain the original. */
export async function compressEvidenceVideo(file: File, onProgress: (percent: number) => void): Promise<CompressedImage> {
  const original = { file, originalBytes: file.size, compressed: false };
  if (!file.type.startsWith("video/") || typeof MediaRecorder === "undefined") return original;
  const type = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/mp4"].find((value) => MediaRecorder.isTypeSupported(value));
  if (!type) return original;
  const video = document.createElement("video") as HTMLVideoElement & { captureStream?: () => MediaStream };
  if (!video.captureStream) return original;
  const url = URL.createObjectURL(file);
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  let recorder: MediaRecorder | undefined;
  let stream: MediaStream | undefined;
  let source: MediaStream | undefined;
  let frame = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("อ่านวิดีโอไม่ได้"));
      timeout = setTimeout(() => reject(new Error("อ่านวิดีโอหมดเวลา")), 10_000);
    });
    clearTimeout(timeout);
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.duration > 120) return original;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(2, Math.round(video.videoWidth * scale / 2) * 2);
    canvas.height = Math.max(2, Math.round(video.videoHeight * scale / 2) * 2);
    const context = canvas.getContext("2d");
    if (!context) return original;
    stream = canvas.captureStream(24);
    source = video.captureStream();
    const chunks: Blob[] = [];
    // Wait for playback so browsers expose the source audio track before recording.
    await video.play();
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
    video.pause();
    video.currentTime = 0;
    for (const track of source.getAudioTracks()) stream.addTrack(track);
    recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 1_500_000, audioBitsPerSecond: 128_000 });
    const result = new Promise<Blob>((resolve, reject) => {
      recorder!.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder!.onstop = () => resolve(new Blob(chunks, { type: type.split(";")[0] }));
      recorder!.onerror = () => reject(new Error("บีบอัดไม่ได้"));
      video.onerror = () => reject(new Error("เล่นวิดีโอไม่ได้"));
      video.onended = () => { if (recorder?.state !== "inactive") recorder?.stop(); };
      timeout = setTimeout(() => reject(new Error("บีบอัดหมดเวลา")), (video.duration + 15) * 1000);
    });
    const draw = () => {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      onProgress(Math.min(99, Math.round(video.currentTime / video.duration * 100)));
      frame = requestAnimationFrame(draw);
    };
    draw();
    recorder.start(1000);
    await video.play();
    const blob = await result;
    if (!blob.size || blob.size >= file.size) return original;
    onProgress(100);
    return { file: new File([blob], file.name.replace(/\.[^.]+$/, "") + (blob.type === "video/mp4" ? ".mp4" : ".webm"), { type: blob.type, lastModified: file.lastModified }), originalBytes: file.size, compressed: true };
  } catch {
    return original;
  } finally {
    clearTimeout(timeout);
    cancelAnimationFrame(frame);
    video.pause();
    if (recorder && recorder.state !== "inactive") recorder.stop();
    stream?.getTracks().forEach((track) => track.stop());
    source?.getTracks().forEach((track) => track.stop());
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
