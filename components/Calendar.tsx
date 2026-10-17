'use client';
import { useMemo, useState } from 'react';
import type { CampaignPlan, ContextFile, EmailCampaign } from '../lib/types';
import type { Selection } from '../lib/planStore';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };

interface Props {
  plan: CampaignPlan; context: ContextFile; selected?: Selection;
  onSelect: (s: Selection) => void;
}

export default function Calendar({ plan, context, selected, onSelect }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const start = useMemo(() => new Date(plan.planStart + 'T00:00:00Z'), [plan.planStart]);
  const weeks = useMemo(() => Array.from({ length: 13 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d))), [start]);

  const byDate = useMemo(() => {
    const m = new Map<string, { e: EmailCampaign; idx: number }[]>();
    plan.sequences.forEach((s, idx) => s.emails.forEach(e => {
      if (!m.has(e.sendDate)) m.set(e.sendDate, []);
      m.get(e.sendDate)!.push({ e, idx });
    }));
    m.forEach(v => v.sort((a, b) => a.e.sendTimeLocal.localeCompare(b.e.sendTimeLocal)));
    return m;
  }, [plan]);
  const holidays = useMemo(() => new Map(context.holidays.map(h => [h.date, h])), [context]);
  const launches = useMemo(() => new Map(context.launches.map(l => [l.date, l])), [context]);
  const blackouts = useMemo(() => new Set(context.sendBlackouts), [context]);

  const toggle = (id: string) => setHidden(h => { const n = new Set(h); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <section className="calendar" aria-label="90-day calendar">
      <div className="legend">
        {plan.sequences.map((s, i) => {
          const off = hidden.has(s.id);
          return (
            <span key={s.id} className={`legend-item seq-${i % 5}${off ? ' off' : ''}${selected?.sequenceId === s.id ? ' sel' : ''}`}>
              <input type="checkbox" checked={!off} onChange={() => toggle(s.id)} aria-label={`Show ${s.name}`} />
              <button type="button" onClick={() => onSelect({ sequenceId: s.id })} title="Open campaign details">{s.name}</button>
            </span>
          );
        })}
      </div>
      <div className="cal-key small muted">
        <span><i className="k k-prop" /> proposed</span><span><i className="k k-appr" /> approved</span>
        <span><i className="k k-rej" /> rejected</span><span><i className="dot" /> edited</span>
        <span>⚑ holiday</span><span>★ launch</span><span><i className="k k-black" /> blackout</span>
      </div>
      <div className="cal-grid" role="grid">
        <div className="cal-head" role="row"><span />{DOW.map(d => <span key={d} role="columnheader">{d}</span>)}</div>
        {weeks.map((days, wi) => {
          const first = days.find(d => d.getUTCDate() === 1) ?? (wi === 0 ? days[0] : undefined);
          return (
            <div className="cal-week" role="row" key={wi}>
              <div className="cal-month">{first ? <><b>{MONTHS[first.getUTCMonth()]}</b><span>{first.getUTCFullYear()}</span></> : <span className="wk">W{wi + 1}</span>}</div>
              {days.map(d => {
                const key = iso(d);
                const inWin = key >= plan.planStart && key <= plan.planEnd;
                const h = holidays.get(key); const l = launches.get(key);
                const items = (byDate.get(key) ?? []).filter(x => !hidden.has(x.e.sequenceId));
                return (
                  <div key={key} role="gridcell" className={`cal-day${!inWin ? ' out' : ''}${blackouts.has(key) ? ' blackout' : ''}${d.getUTCDate() === 1 ? ' first' : ''}`}>
                    <div className="day-num">{d.getUTCDate() === 1 ? `${MONTHS[d.getUTCMonth()]} 1` : d.getUTCDate()}</div>
                    {h && <div className="marker marker-h" title={`${h.name} (${h.kind})`}>⚑ {h.name}</div>}
                    {l && <div className={`marker marker-l${l.inventoryConstrained ? ' limited' : ''}`} title={l.name}>★ {l.name}</div>}
                    {blackouts.has(key) && <div className="marker marker-b">No send</div>}
                    {items.map(({ e, idx }) => {
                      const sel = selected?.emailId === e.id;
                      return (
                        <button type="button" key={e.id}
                          className={`ecp seq-${idx % 5} st-${e.status}${sel ? ' selected' : ''}`}
                          onClick={() => onSelect({ sequenceId: e.sequenceId, emailId: e.id })}
                          title={`${e.sendTimeLocal} · ${e.subject} (${e.status})`}>
                          <span className="ecp-ico">{e.status === 'approved' ? '✓' : e.status === 'rejected' ? '✕' : ''}</span>
                          <span className="ecp-text">{e.subject}</span>
                          {e.guardrailFlags.length > 0 && <span className="ecp-warn" aria-label="guardrail flag">⚠</span>}
                          {e.editedByUser && <span className="dot" aria-label="edited" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
