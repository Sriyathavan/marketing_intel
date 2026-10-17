'use client';
import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { CampaignPlan, EmailCampaign, ReviewStatus, SegmentProfile } from '../lib/types';
import { assignLanes, inSpan, sequenceSpan, spanRange } from '../lib/sequenceSpan';
import type { Selection } from '../lib/planStore';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON_SHORT = MONTHS.map(m => m.slice(0, 3));

// Pastel family per sequence (Design.md), light fill for pills.
export const FAMILIES = ['bg-mint hover:bg-mint-deep', 'bg-sky hover:bg-sky-deep', 'bg-butter hover:bg-butter-deep', 'bg-peach hover:bg-peach-deep', 'bg-rose hover:bg-rose-deep', 'bg-lilac hover:bg-lilac-deep', 'bg-sage hover:bg-sage-deep'] as const;
/** Solid swatch per family, for small markers in the detail panel. */
export const FAMILY_SWATCH = ['bg-mint-deep', 'bg-sky-deep', 'bg-butter-deep', 'bg-peach-deep', 'bg-rose-deep', 'bg-lilac-deep', 'bg-sage-deep'] as const;
export const STATUS_LABEL: Record<ReviewStatus, string> = { proposed: 'Proposed', approved: 'Approved', rejected: 'Rejected' };
const STATUS_EDGE: Record<ReviewStatus, string> = { proposed: 'border-l-[#e0a100]', approved: 'border-l-ok', rejected: 'border-l-bad' };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

interface Props { plan: CampaignPlan; segments: SegmentProfile[]; selected?: Selection; onSelect: (s: Selection) => void }

export default function Calendar({ plan, segments, selected, onSelect }: Props) {
  const first = useMemo(() => new Date(plan.planStart + 'T00:00:00Z'), [plan.planStart]);
  const last = useMemo(() => new Date(plan.planEnd + 'T00:00:00Z'), [plan.planEnd]);
  const minIdx = first.getUTCFullYear() * 12 + first.getUTCMonth();
  const maxIdx = last.getUTCFullYear() * 12 + last.getUTCMonth();
  const [idx, setIdx] = useState(minIdx);
  const [today, setToday] = useState<string>();
  useEffect(() => setToday(iso(new Date())), []);

  const year = Math.floor(idx / 12), month = idx % 12;
  const weeks = useMemo(() => {
    const firstOfMonth = utc(year, month, 1);
    const lead = (firstOfMonth.getUTCDay() + 6) % 7; // Monday-first
    const gridStart = addDays(firstOfMonth, -lead);
    const lastOfMonth = utc(year, month + 1, 0);
    const n = Math.ceil((lead + lastOfMonth.getUTCDate()) / 7);
    return Array.from({ length: n }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(gridStart, w * 7 + d)));
  }, [year, month]);

  const byDate = useMemo(() => {
    const m = new Map<string, { e: EmailCampaign; si: number; seqName: string }[]>();
    plan.sequences.forEach((s, si) => s.emails.forEach(e => {
      const arr = m.get(e.sendDate) ?? [];
      arr.push({ e, si, seqName: s.name });
      m.set(e.sendDate, arr);
    }));
    m.forEach(v => v.sort((a, b) => a.e.sendTimeLocal.localeCompare(b.e.sendTimeLocal)));
    return m;
  }, [plan]);

  const spans = useMemo(() => plan.sequences.map(sq => sequenceSpan(sq)), [plan]);
  const lanes = useMemo(() => assignLanes(plan.sequences), [plan]);
  const laneCount = Math.max(1, ...Array.from(lanes.values()).map(l => l + 1));
  const segName = (id: string) => segments.find(g => g.id === id)?.name ?? id;

  return (
    <section aria-label="Email calendar" className="grid items-start gap-6 xl:grid-cols-[272px_minmax(0,1fr)]">
      <aside aria-label="Sequences" className="rounded-xl border border-border bg-surface p-4 xl:sticky xl:top-20">
        <h2 className="mb-3 text-sm font-semibold">Sequences</h2>
        <ul className="space-y-3.5">
          {plan.sequences.map((sq, si) => (
            <li key={sq.id} className="flex gap-2.5">
              <i aria-hidden className={cn('mt-1 size-3 shrink-0 rounded-sm', FAMILY_SWATCH[si % FAMILY_SWATCH.length])} />
              <div className="min-w-0 text-[13px] leading-snug">
                <div className="font-medium">{sq.name}</div>
                <div className="text-muted-foreground">{segName(sq.segmentId)}</div>
                <div className="tabular text-muted-foreground">{spanRange(spans[si])}</div>
              </div>
            </li>
          ))}
        </ul>
      </aside>
      <div className="min-w-0">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Previous month" disabled={idx <= minIdx} onClick={() => setIdx(i => i - 1)}><ChevronLeft /></Button>
          <Button variant="outline" size="icon" aria-label="Next month" disabled={idx >= maxIdx} onClick={() => setIdx(i => i + 1)}><ChevronRight /></Button>
          <h2 className="ml-2 text-lg font-semibold tracking-tight" aria-live="polite">{MONTHS[month]} {year}</h2>
        </div>
        <ul className="flex items-center gap-4 text-xs text-muted-foreground" aria-label="Status key">
          <li className="flex items-center gap-1.5"><i className="h-3.5 w-[3px] rounded-full bg-[#e0a100]" />Proposed</li>
          <li className="flex items-center gap-1.5"><i className="h-3.5 w-[3px] rounded-full bg-ok" />Approved</li>
          <li className="flex items-center gap-1.5"><i className="h-3.5 w-[3px] rounded-full bg-bad" />Rejected</li>
        </ul>
      </div>

      <div role="grid" aria-label={`${MONTHS[month]} ${year}`} className="overflow-hidden rounded-lg border border-border bg-surface">
        <div role="row" className="grid grid-cols-7 border-b border-border">
          {DOW.map(d => <div key={d} role="columnheader" className="px-3 py-2 text-xs font-medium text-muted-foreground">{d}</div>)}
        </div>
        {weeks.map((week, wi) => (
          <div role="row" key={wi} className={cn('grid grid-cols-7', wi > 0 && 'border-t border-border')}>
            {week.map((d, di) => {
              const key = iso(d);
              const inMonth = d.getUTCMonth() === month;
              const items = inMonth ? byDate.get(key) ?? [] : [];
              const label = d.getUTCDate() === 1 ? `${MON_SHORT[d.getUTCMonth()]} 1` : String(d.getUTCDate());
              return (
                <div role="gridcell" key={key} aria-label={inMonth ? undefined : 'Outside this month'}
                  className={cn('min-h-[140px] min-w-0 pb-1.5', di > 0 && 'border-l border-border', !inMonth && 'bg-out-month', key === today && inMonth && 'bg-today')}>
                  <div aria-hidden className="mb-1.5 flex flex-col gap-[3px] pt-[3px]" style={{ minHeight: laneCount * 7 - 3 }}>
                    {inMonth && Array.from({ length: laneCount }, (_, lane) => {
                      const si = plan.sequences.findIndex(sq => lanes.get(sq.id) === lane && inSpan(spans[plan.sequences.indexOf(sq)], key));
                      if (si < 0) return <span key={lane} className="h-1" />;
                      const sp = spans[si];
                      return <span key={lane} className={cn('h-1', FAMILY_SWATCH[si % FAMILY_SWATCH.length], key === sp.start && 'ml-1.5 rounded-l-full', key === sp.end && 'mr-1.5 rounded-r-full')} />;
                    })}
                  </div>
                  <div className={cn('px-2.5 pb-1.5 text-xs font-medium tabular', inMonth ? 'text-muted-foreground' : 'text-date-faded')}>{label}</div>
                  <ul className="flex flex-col gap-1 px-1.5">
                    {items.map(({ e, si, seqName }) => {
                      const isSel = selected?.emailId === e.id;
                      return (
                        <li key={e.id}>
                          <button type="button" data-email-id={e.id} onClick={() => onSelect({ sequenceId: e.sequenceId, emailId: e.id })}
                            aria-label={`${e.subject}. ${seqName}, email ${e.step}. ${STATUS_LABEL[e.status]}.`}
                            aria-haspopup="dialog"
                            className={cn(
                              'flex w-full items-start gap-1 rounded-[4px] border-l-[3px] px-2 py-1.5 text-left text-[12px] font-medium leading-snug text-[#2b2b2b] transition-colors',
                              FAMILIES[si % FAMILIES.length], STATUS_EDGE[e.status],
                              isSel && 'ring-2 ring-accent ring-offset-1',
                              e.status === 'rejected' && 'opacity-50')}>
                            <span className="min-w-0 flex-1 break-words">{e.subject}</span>
                            {e.status === 'approved' && <Check aria-hidden className="mt-0.5 size-3 shrink-0 text-ok" strokeWidth={3} />}
                            {e.status === 'rejected' && <X aria-hidden className="mt-0.5 size-3 shrink-0 text-bad" strokeWidth={3} />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      </div>
    </section>
  );
}
