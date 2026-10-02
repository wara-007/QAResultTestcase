/** Find complete JSON blocks even when surrounded by plain log messages. */
export function resultFoldRanges(text: string): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = [];
  const stack: number[] = [];
  let quoted = false;
  let escaped = false;
  let pending: { from: number; to: number }[] = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"' && stack.length) { quoted = true; continue; }
    if (char === "{" || char === "[") stack.push(i);
    else if ((char === "}" || char === "]") && stack.length) {
      const start = stack.pop()!;
      if ((text[start] === "{") !== (char === "}")) { stack.length = 0; pending = []; continue; }
      if (text.slice(start, i).includes("\n")) pending.push({ from: start + 1, to: i });
      if (!stack.length) {
        try { JSON.parse(text.slice(start, i + 1)); ranges.push(...pending); } catch { /* Plain log brackets aren't JSON. */ }
        pending = [];
      }
    }
  }
  return ranges.sort((a, b) => a.from - b.from);
}
