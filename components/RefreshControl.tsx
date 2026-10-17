'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, Loader2, RefreshCw, X } from 'lucide-react';
import { Button } from './ui/button';
import { savePersisted } from '../lib/planStore';
import { applyRefreshEvent, idleRefresh, parseNdjson, startRefresh, type RefreshState, type StageStatus } from '../lib/refreshProgress';
import { cn } from '../lib/utils';

function StageIcon({ s }: { s: StageStatus }) {
  if (s === 'done') return <span className="grid size-5 place-items-center rounded-full bg-ok text-white"><Check className="size-3" strokeWidth={3} /></span>;
  if (s === 'running') return <Loader2 aria-hidden className="size-5 animate-spin text-accent" />;
  return <span aria-hidden className="size-5 rounded-full border-2 border-border-strong" />;
}
const WORD: Record<StageStatus, string> = { pending: 'Pending', running: 'Running', done: 'Done' };

export default function RefreshControl() {
  const router = useRouter();
  const [st, setSt] = useState<RefreshState>(idleRefresh);
  const running = st.phase === 'running';
  const busy = useRef(false);

  async function run() {
    if (busy.current) return;
    busy.current = true;
    let cur = startRefresh;
    setSt(cur);
    const push = (ev: Parameters<typeof applyRefreshEvent>[1]) => { cur = applyRefreshEvent(cur, ev); setSt(cur); };
    try {
      const res = await fetch('/api/refresh', { method: 'POST' });
      if (!res.ok || !res.body) throw new Error(`Refresh failed (HTTP ${res.status})`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        buf += dec.decode(value, { stream: !done });
        const { events, rest } = parseNdjson(done ? buf + '\n' : buf);
        buf = rest;
        events.forEach(push);
        if (done) break;
      }
      if (cur.phase === 'running') throw new Error('The refresh ended before it finished.');
      if (cur.phase === 'done') {
        savePersisted(undefined); // reviews belong to the old plan
        router.refresh();
      }
    } catch (e) {
      if (cur.phase !== 'error') push({ stage: 'error', message: e instanceof Error ? e.message : 'Refresh failed' });
    } finally { busy.current = false; }
  }

  const stages: { key: 'data' | 'analyst' | 'planner'; label: string; note?: string }[] = [
    { key: 'data', label: 'Reading data' },
    { key: 'analyst', label: 'Analyst finding trends', note: st.insights != null ? `${st.insights} findings` : undefined },
    { key: 'planner', label: 'Planner building the calendar', note: st.sequences != null ? `${st.sequences} sequences` : undefined },
  ];

  return (
    <>
      <Button variant="outline" size="sm" onClick={run} disabled={running} aria-busy={running}>
        <RefreshCw className={cn(running && 'animate-spin')} /> {running ? 'Refreshing' : 'Refresh'}
      </Button>
      {st.phase !== 'idle' && (
        <section aria-label="Refresh progress" aria-live="polite"
          className="fixed right-6 top-16 z-40 w-[min(400px,calc(100vw-32px))] rounded-xl border border-border-strong bg-surface p-5 shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {st.phase === 'running' ? 'Refreshing data and plan' : st.phase === 'done' ? 'Refresh complete' : 'Refresh failed'}
            </h2>
            {!running && <button type="button" aria-label="Dismiss" onClick={() => setSt(idleRefresh)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="size-4" /></button>}
          </div>
          <ol className="space-y-3.5">
            {stages.map(s => (
              <li key={s.key}>
                <div className="flex items-center gap-3 text-[13px]">
                  <StageIcon s={st[s.key]} />
                  <span className={cn('font-medium', st[s.key] === 'pending' && 'text-muted-foreground')}>{s.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{s.note && st[s.key] === 'done' ? s.note : WORD[st[s.key]]}</span>
                </div>
                {s.key === 'data' && st.keywords.length > 0 && (
                  <ul aria-label="Keywords being analysed" className="ml-8 mt-2 flex flex-wrap gap-1.5">
                    {st.keywords.map(k => (
                      <li key={k} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs">
                        <Check aria-hidden className="size-3 text-ok" strokeWidth={3} />{k}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
          {st.phase === 'error' && (
            <p role="alert" className="mt-4 flex gap-2 rounded-md border border-bad/40 bg-[#fbe7e6] p-3 text-[13px] text-[#8a2f2c]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />{st.error}
            </p>
          )}
        </section>
      )}
    </>
  );
}
