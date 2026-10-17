'use client';
import { useEffect, useRef, useState } from 'react';
import type { CampaignPlan, Opportunity, SegmentProfile } from '../lib/types';
import { approvedCount } from '../lib/planStore';
import { mockToCsv, mockToMarkdown } from './__mocks__/mockData';

interface Props { plan?: CampaignPlan; opportunities: Opportunity[]; segments: SegmentProfile[]; useMock: boolean }

async function render(kind: 'csv' | 'md', p: Props): Promise<string> {
  const plan = p.plan!;
  if (p.useMock) return kind === 'csv' ? mockToCsv(plan) : mockToMarkdown(plan);
  const ex = await import('../lib/export');
  return kind === 'csv' ? ex.toCsv(plan, p.opportunities, p.segments) : ex.toMarkdown(plan, p.opportunities, p.segments);
}

export default function ExportButton(props: Props) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const n = approvedCount(props.plan);
  useEffect(() => {
    const f = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
  }, []);

  async function download(kind: 'csv' | 'md') {
    setOpen(false); setErr('');
    try {
      const text = await render(kind, props);
      const blob = new Blob([text], { type: kind === 'csv' ? 'text/csv;charset=utf-8' : 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `marketing-plan-${props.plan!.planStart}.${kind}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setErr('Export failed'); }
  }

  return (
    <div className="menu" ref={ref}>
      <button type="button" className="btn" disabled={n < 1} aria-haspopup="menu" aria-expanded={open}
        title={n < 1 ? 'Approve at least one email to export' : undefined} onClick={() => setOpen(o => !o)}>
        Export ({n}) <span aria-hidden>▾</span>
      </button>
      {open && (
        <div className="menu-pop" role="menu">
          <button role="menuitem" type="button" onClick={() => download('csv')}>CSV (approved only)</button>
          <button role="menuitem" type="button" onClick={() => download('md')}>Markdown (approved only)</button>
        </div>
      )}
      {err && <span className="err small">{err}</span>}
    </div>
  );
}
