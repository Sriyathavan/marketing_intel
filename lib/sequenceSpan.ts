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
  const spacingDays = s.cadence?.spacingDays || (n > 1 ? Math.max(1, Math.round((days - 1) / (n - 1))) : 0);
  return { start, end, days, emails: n, spacingDays };
}

export const spanRange = (i: SpanInfo) => `${shortDate(i.start)} – ${shortDate(i.end)}`;

/** "Runs Nov 3 - Dec 9 (37 days), 6 emails, about every 7 days" */
export function spanSentence(i: SpanInfo): string {
  const every = i.emails > 1 && i.spacingDays > 0 ? `, about every ${i.spacingDays} day${i.spacingDays === 1 ? '' : 's'}` : '';
  return `Runs ${spanRange(i)} (${i.days} day${i.days === 1 ? '' : 's'}), ${i.emails} email${i.emails === 1 ? '' : 's'}${every}`;
}

/** Greedy lane per sequence so overlapping sequences stack in stable rows. Returns lane by sequence id. */
export function assignLanes(seqs: EmailSequence[]): Map<string, number> {
  const info = seqs.map(s => ({ id: s.id, ...sequenceSpan(s) })).sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
  const laneEnd: string[] = [];
  const out = new Map<string, number>();
  for (const s of info) {
    let lane = laneEnd.findIndex(e => e < s.start);
    if (lane === -1) { lane = laneEnd.length; laneEnd.push(s.end); } else laneEnd[lane] = s.end;
    out.set(s.id, lane);
  }
  return out;
}

export const inSpan = (i: SpanInfo, date: string) => date >= i.start && date <= i.end;
