import type { TextHighlight } from "./result-preview";

type JsonToken = { from: number; to: number; kind: "key" | "string" | "number" | "literal" };

/** Tolerant lexical colors for JSON embedded in HTTP/log text; source offsets never change. */
export function resultJsonTokens(text: string, highlights: TextHighlight[] = []): JsonToken[] {
  const tokens: JsonToken[] = [];
  let depth = /^\s*"[^"\n]+"\s*:/.test(text) ? 1 : 0;
  for (let i = 0; i < text.length;) {
    const char = text[i];
    if (!depth) {
      const rest = text.slice(i);
      if ((char === "{" && /^\{\s*(?:"|\}|$)/.test(rest)) || (char === "[" && /^\[\s*(?:[\[{"\d-]|true\b|false\b|null\b|\]|$)/.test(rest))) depth = 1;
      i++;
      continue;
    }
    if (char === '"') {
      const start = i++;
      let closed = false;
      while (i < text.length) {
        if (text[i] === "\\") { i = Math.min(text.length, i + 2); continue; }
        if (text[i++] === '"') { closed = true; break; }
      }
      tokens.push({ from: start, to: i, kind: closed && /^\s*:/.test(text.slice(i)) ? "key" : "string" });
      continue;
    }
    if (char === "{" || char === "[") { depth++; i++; continue; }
    if (char === "}" || char === "]") { depth--; i++; continue; }
    if (char === "-" || /[\dntf]/.test(char)) {
      const match = text.slice(i).match(/^(?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true\b|false\b|null\b)/);
      if (match) {
        tokens.push({ from: i, to: i + match[0].length, kind: /^(?:true|false|null)$/.test(match[0]) ? "literal" : "number" });
        i += match[0].length;
        continue;
      }
    }
    i++;
  }
  // Explicit QA foreground colors take precedence; background-only marks keep syntax colors.
  return tokens.flatMap(token => {
    let pieces = [token];
    for (const mark of highlights) {
      // Sheets also exports default black as a foreground mark; it is not a QA color annotation.
      if (!mark.color || /^(?:#000(?:000)?|black|rgba?\(\s*0\s*,\s*0\s*,\s*0(?:\s*,\s*1)?\s*\))$/i.test(mark.color.trim())) continue;
      pieces = pieces.flatMap(piece => mark.end <= piece.from || mark.start >= piece.to ? [piece] : [
        ...(mark.start > piece.from ? [{ ...piece, to: mark.start }] : []),
        ...(mark.end < piece.to ? [{ ...piece, from: mark.end }] : []),
      ]);
    }
    return pieces;
  });
}

/** Recognize JSON documents/fragments, without treating HTTP exports as one JSON document. */
export function inspectResultJson(text: string) {
  const value = text.trimStart();
  const isJsonLike = value.startsWith("{") || /^"[^"\n]+"\s*:/.test(value) || /^\[\s*(?:[\[{"\d-]|true\b|false\b|null\b|\]|$)/.test(value);
  if (!isJsonLike) return { isJsonLike: false, valid: false };
  try { JSON.parse(text); return { isJsonLike: true, valid: true }; }
  catch { return { isJsonLike: true, valid: false }; }
}

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
