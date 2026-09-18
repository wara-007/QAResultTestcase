export function parseFlexibleDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value ?? "").trim();
  if (!text) return null;

  const serial = Number(text);
  if (/^\d+(?:\.\d+)?$/.test(text) && serial > 0 && serial < 100_000) {
    const date = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const dayFirst = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dayFirst) {
    const [, day, month, rawYear, hour = "0", minute = "0", second = "0"] = dayFirst;
    const year = Number(rawYear) > 2400 ? Number(rawYear) - 543 : Number(rawYear);
    const date = new Date(year, Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    if (date.getFullYear() === year && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day)) return date;
  }

  const timestamp = Date.parse(text);
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
}

export function formatFlexibleDate(value: unknown, includeTime = true) {
  const date = parseFlexibleDate(value);
  if (!date) return String(value ?? "").trim() || "ไม่ระบุเวลา";
  return new Intl.DateTimeFormat("th-TH", includeTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" }).format(date);
}
