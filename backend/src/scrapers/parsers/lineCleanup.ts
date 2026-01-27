const DROP_LINE_PATTERNS: RegExp[] = [
  /^credit cards?$/i,
  /^learn more$/i,
  /^learn more about/i,
  /^view details$/i,
  /^see details$/i,
  /^apply now$/i,
  /^terms? of service$/i,
  /^privacy policy$/i,
];

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;|\u00a0/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLine(line: string): string {
  return stripHtml(line)
    .replace(/\$\{[^}]+\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanExtractedLines(lines: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of lines) {
    const cleaned = normalizeLine(String(raw || ""));
    if (!cleaned || cleaned.length < 8) continue;
    if (DROP_LINE_PATTERNS.some((rx) => rx.test(cleaned))) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }

  return out;
}
