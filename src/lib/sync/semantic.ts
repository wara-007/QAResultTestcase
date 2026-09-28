const invisibleCharacters = /[\u200B-\u200D\u2060\uFEFF]/gu;
const whitespace = /\s+/gu;

export function normalizeComparableText(value: string) {
  return value
    .normalize("NFKC")
    .replace(invisibleCharacters, "")
    .replace(whitespace, " ")
    .trim();
}
