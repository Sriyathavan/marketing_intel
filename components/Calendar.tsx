'use client';
import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { CampaignPlan, EmailCampaign, ReviewStatus, SegmentProfile } from '../lib/types';
import { sequenceSpan, spanRange } from '../lib/sequenceSpan';
import type { Selection } from '../lib/planStore';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON_SHORT = MONTHS.map(m => m.slice(0, 3));

// One distinct, subtle colour per sequence (12, no repeats for up to 12 sequences).
export const SEQ_COLORS = ['#4fb39d', '#6b97d1', '#e0b040', '#e58b68', '#d97590', '#a487d1', '#7dbb62', '#47aec9', '#bf9a63', '#8f9db5', '#cc80c0', '#aebb45'] as const;
export const seqColor = (i: number) => SEQ_COLORS[i % SEQ_COLORS.length];
/** Pill tint and hover tint derived from the sequence colour, so strip, pill and legend match. */
export const FAMILIES = 'bg-[color-mix(in_srgb,var(--seq)_28%,white)] hover:bg-[color-mix(in_srgb,var(--seq)_42%,white)]';
export const STATUS_LABEL: Record<ReviewStatus, string> = { proposed: 'Proposed', approved: 'Approved', rejected: 'Rejected' };

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
  const segName = (id: string) => segments.find(g => g.id === id)?.name ?? id;

  return (
    <section aria-label="Email calendar" className="grid items-start gap-6 xl:grid-cols-[272px_minmax(0,1fr)]">
      <aside aria-label="Sequences" className="rounded-xl border border-border bg-surface p-4 xl:sticky xl:top-20">
        <h2 className="mb-3 text-sm font-semibold">Sequences</h2>
        <ul className="space-y-3.5">
          {plan.sequences.map((sq, si) => (
            <li key={sq.id} className="flex gap-2.5">
              <i aria-hidden className="mt-1 size-3 shrink-0 rounded-sm" style={{ backgroundColor: seqColor(si) }} />
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
                  className={cn('min-h-[140px] min-w-0 pb-1.5 pt-1.5', di > 0 && 'border-l border-border', !inMonth && 'bg-out-month', key === today && inMonth && 'bg-today')}>
                  <div className={cn('px-2.5 pb-1.5 text-xs font-medium tabular', inMonth ? 'text-muted-foreground' : 'text-date-faded')}>{label}</div>
                  <ul className="flex flex-col gap-1 px-1.5">
                    {items.map(({ e, si, seqName }) => {
                      const isSel = selected?.emailId === e.id;
                      return (
                        <li key={e.id}>
                          <button type="button" data-email-id={e.id} onClick={() => onSelect({ sequenceId: e.sequenceId, emailId: e.id })}
                            aria-label={`${e.subject}. ${seqName}, email ${e.step}. ${STATUS_LABEL[e.status]}.`}
                            aria-haspopup="dialog" style={{ '--seq': seqColor(si) } as React.CSSProperties}
                            className={cn(
                              'flex w-full items-start gap-1 rounded-[4px] border-l-[4px] border-l-[var(--seq)] px-2 py-1.5 text-left text-[12px] font-medium leading-snug text-[#2b2b2b] transition-colors',
                              FAMILIES,
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
