import type { EmailSequence } from './types';

export interface SpanInfo { start: string; end: string; days: number; emails: number; spacingDays: number }

const MS_DAY = 86_400_000;
const t = (d: string) => Date.parse(d + 'T00:00:00Z');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Short date like "Nov 3" from an ISO date. */
export function shortDate(d: string): string {
  return `${MON[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`;
}

/** Span of a sequence. Uses the plan's startDate/endDate/durationDays, falling back to the email send dates. */
export function sequenceSpan(s: EmailSequence): SpanInfo {
  const dates = s.emails.map(e => e.sendDate).sort();
  const start = s.startDate || dates[0] || '';
  const end = s.endDate || dates[dates.length - 1] || start;
  const days = s.durationDays || (start ? Math.round((t(end) - t(start)) / MS_DAY) + 1 : 0);
  const n = s.emails.length;
  const spacingDays = Math.round(s.cadence?.spacingDays || 0) || (n > 1 ? Math.max(1, Math.round((days - 1) / (n - 1))) : 0);
  return { start, end, days, emails: n, spacingDays };
}

export const spanRange = (i: SpanInfo) => `${shortDate(i.start)} to ${shortDate(i.end)}`;

/** "Runs Nov 3 - Dec 9 (37 days), 6 emails, about every 7 days" */
export function spanSentence(i: SpanInfo): string {
  const every = i.emails > 1 && i.spacingDays > 0 ? `, about every ${i.spacingDays} day${i.spacingDays === 1 ? '' : 's'}` : '';
  return `Runs ${spanRange(i)} (${i.days} day${i.days === 1 ? '' : 's'}), ${i.emails} email${i.emails === 1 ? '' : 's'}${every}`;
}

/** Sequences ordered by earliest start date (ties by id). One place so every view agrees. */
export function sortSequences<T extends EmailSequence>(seqs: T[]): T[] {
  return [...seqs].sort((a, b) => sequenceSpan(a).start.localeCompare(sequenceSpan(b).start) || a.id.localeCompare(b.id));
}
