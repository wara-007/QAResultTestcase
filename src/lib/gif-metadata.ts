export type GifMetadata = { width: number; height: number; delays: number[]; loopCount: number | null };

/** Inspect container blocks only, never allocate decoded frame buffers. */
export function readGifMetadata(bytes: Uint8Array): GifMetadata | undefined {
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
  if (bytes.length < 14 || !['GIF87a', 'GIF89a'].includes(ascii(0, 6))) return;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const word = (at: number) => view.getUint16(at, true);
  const width = word(6), height = word(8);
  if (!width || !height) return;
  let offset = 13 + ((bytes[10] & 128) ? 3 * 2 ** ((bytes[10] & 7) + 1) : 0);
  let delay = 0, loopCount: number | null = null;
  const delays: number[] = [];
  const skipBlocks = (start: number): number | undefined => {
    while (start < bytes.length) {
      const size = bytes[start++];
      if (!size) return start;
      start += size;
    }
  };
  try {
    while (offset < bytes.length) {
      const type = bytes[offset++];
      if (type === 0x3b) return delays.length ? { width, height, delays, loopCount } : undefined;
      if (type === 0x2c) {
        if (offset + 9 > bytes.length) return;
        const frameWidth = word(offset + 4), frameHeight = word(offset + 6);
        if (!frameWidth || !frameHeight || word(offset) + frameWidth > width || word(offset + 2) + frameHeight > height) return;
        const packed = bytes[offset + 8]; offset += 9;
        if (packed & 128) offset += 3 * 2 ** ((packed & 7) + 1);
        if (offset >= bytes.length || bytes[offset] < 2 || bytes[offset] > 8) return;
        const next = skipBlocks(offset + 1);
        if (next === undefined || delays.length >= 2500) return;
        offset = next; delays.push(delay); delay = 0;
      } else if (type === 0x21) {
        if (offset >= bytes.length) return;
        const extension = bytes[offset++];
        // Plain-text extensions are rendered content; leave unusual files alone.
        if (extension === 0x01) return;
        if (extension === 0xf9) {
          if (offset + 6 > bytes.length || bytes[offset] !== 4 || bytes[offset + 5] !== 0) return;
          delay = word(offset + 2); offset += 6;
        } else {
          if (extension === 0xff && bytes[offset] === 11 && ['NETSCAPE2.0', 'ANIMEXTS1.0'].includes(ascii(offset + 1, 11))) {
            const start = offset + 12;
            if (start + 5 > bytes.length || bytes[start] !== 3 || bytes[start + 1] !== 1) return;
            loopCount = word(start + 2);
          }
          const next = skipBlocks(offset); if (next === undefined) return; offset = next;
        }
      } else return;
    }
  } catch { return; }
}

export function sameGifAnimation(before: GifMetadata, after: GifMetadata): boolean {
  return before.width === after.width && before.height === after.height && before.loopCount === after.loopCount
    && before.delays.length === after.delays.length && before.delays.every((delay, index) => delay === after.delays[index]);
}
