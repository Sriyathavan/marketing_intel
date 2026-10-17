import type { Evidence, Insight, InsightsFile } from '../../lib/types';
import { INTEREST_LABELS } from '../../lib/dashboard';
import { Card } from './Section';
import { cn } from '../../lib/utils';

const MOMENTUM: Record<Insight['momentum'], string> = { rising: 'Rising', steady: 'Steady', declining: 'Declining' };
const MOMENTUM_STYLE: Record<Insight['momentum'], string> = {
  rising: 'bg-[#e1f4ea] text-[#1b6b47]', steady: 'bg-muted text-muted-foreground', declining: 'bg-[#fbe7e6] text-[#9a3532]',
};

interface Props {
  insights: InsightsFile | null | undefined;
  segmentNames: Record<string, string>; trendNames: Record<string, string>; evidence: Record<string, Evidence>;
}

export default function Insights({ insights, segmentNames, trendNames, evidence }: Props) {
  if (!insights) return <Card><p className="text-sm text-muted-foreground">No analyst findings yet. Use Refresh to generate them.</p></Card>;
  const list = insights.insights ?? [];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Global search trends"><p className="text-sm leading-relaxed">{insights.trendSummary}</p></Card>
        <Card title="Our customers"><p className="text-sm leading-relaxed">{insights.customerSummary}</p></Card>
      </div>
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map(i => (
          <li key={i.id} className={cn('flex flex-col rounded-lg border border-border bg-surface p-5', list.length % 3 === 1 && 'last:xl:col-span-3')}>
            <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
              <span className={cn('rounded-full border px-2 py-0.5', i.label === 'observed' ? 'border-ok/50 bg-[#e1f4ea] text-[#1b6b47]' : 'border-[#e0a100]/60 bg-[#fff6dc] text-[#7a5a00]')}>
                {i.label === 'observed' ? 'Observed' : 'Interpreted'}
              </span>
              <span className={cn('rounded-full px-2 py-0.5', MOMENTUM_STYLE[i.momentum])}>{MOMENTUM[i.momentum]}</span>
              <span className="text-muted-foreground">{INTEREST_LABELS[i.interest] ?? i.interest}</span>
            </div>
            <h3 className="text-sm font-semibold leading-snug">{i.title}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed">{i.summary}</p>
            {(i.segmentIds.length > 0 || i.trendIds.length > 0) && (
              <p className="mt-2 text-xs text-muted-foreground">
                {[...i.trendIds.map(t => trendNames[t] ?? t), ...i.segmentIds.map(s => segmentNames[s] ?? s)].join(' · ')}
              </p>
            )}
            {i.evidenceIds.length > 0 && (
              <ul aria-label="Evidence" className="mt-auto flex flex-wrap gap-1.5 pt-3">
                {i.evidenceIds.map(id => {
                  const ev = evidence[id];
                  return (
                    <li key={id} className="rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground"
                      title={ev ? `${ev.source.file} / ${ev.source.ref}` : undefined}>
                      {ev ? <>{ev.label} <span className="font-semibold text-foreground">{ev.value}{ev.unit ?? ''}</span></> : id}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
