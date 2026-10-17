// Model-written text must never contain em dashes, en dashes, arrows or emojis.
// Characters are written as escapes so this file passes its own scan.
const EM = '\u2014';
const EN = '\u2013';
const ARROWS = '\u2190-\u21FF\u27F0-\u27FF\u2900-\u297F';
const EMOJI = '\u{1F000}-\u{1FFFF}\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u200D';

const re = (s: string, f = 'gu') => new RegExp(s, f);

export function sanitizeText(input: string): string {
  let s = input;
  s = s.replace(re(`\\s*[${EN}]\\s*`), (m, off: number, all: string) => {
    const before = all[off - 1] ?? '';
    const after = all[off + m.length] ?? '';
    return /\d/.test(before) || /\d/.test(after) ? ' to ' : ', ';
  });
  s = s.replace(re(`\\s*${EM}\\s*`), ', ');
  s = s.replace(re(`\\s*[${ARROWS}]\\s*`), ' to ');
  s = s.replace(re(`[${EMOJI}]`), '');
  return s.replace(/ {2,}/g, ' ').replace(/ ,/g, ',').replace(/,\s*,/g, ',');
}

/** Deep-copy with every string value cleaned. Object keys are left alone. */
export function sanitizeDeep<T>(v: T): T {
  if (typeof v === 'string') return sanitizeText(v) as unknown as T;
  if (Array.isArray(v)) return v.map(sanitizeDeep) as unknown as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sanitizeDeep(x)])) as T;
  return v;
}
