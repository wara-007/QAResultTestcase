/** Valid deliberately unoptimized GIF: clear LZW before every pixel. */
export function animatedGifFixture(options: { width?: number; height?: number; delays?: number[]; loopCount?: number; commentBytes?: number; disposal?: number; transparent?: boolean } = {}) {
  const width = options.width ?? 256, height = options.height ?? 128;
  const delays = options.delays ?? [10, 20, 30, 40];
  const output: number[] = [];
  const word = (n: number) => output.push(n & 255, n >> 8 & 255);
  const ascii = (text: string) => { for (const character of text) output.push(character.charCodeAt(0)); };
  const blocks = (data: number[]) => {
    for (let offset = 0; offset < data.length; offset += 255) {
      const part = data.slice(offset, offset + 255); output.push(part.length, ...part);
    }
    output.push(0);
  };
  ascii('GIF89a'); word(width); word(height); output.push(0xf1, 0, 0);
  output.push(0,0,0, 255,255,255, 230,30,30, 30,30,230);
  output.push(0x21,0xff,11); ascii('NETSCAPE2.0'); output.push(3,1); word(options.loopCount ?? 2); output.push(0);
  if (options.commentBytes) { output.push(0x21,0xfe); blocks(Array(options.commentBytes).fill(65)); }
  delays.forEach((delay, frame) => {
    output.push(0x21,0xf9,4,((options.disposal ?? 1) << 2) | (options.transparent ? 1 : 0)); word(delay); output.push(0,0);
    output.push(0x2c); word(0); word(0); word(width); word(height); output.push(0,2);
    const data: number[] = []; let bits = 0, value = 0;
    const code = (n: number) => { value |= n << bits; bits += 3; while (bits >= 8) { data.push(value & 255); value >>>= 8; bits -= 8; } };
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const cursor = x >= 12 + frame * 10 && x < 28 + frame * 10 && y >= 20 && y < 36;
      code(4); code(cursor ? 2 : (x + y) % 2);
    }
    code(5); if (bits) data.push(value & 255); blocks(data);
  });
  output.push(0x3b);
  return new Uint8Array(output);
}
