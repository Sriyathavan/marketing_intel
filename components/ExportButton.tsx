'use client';
import { useState } from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Download } from 'lucide-react';
import type { CampaignPlan, Insight, Opportunity, SegmentProfile } from '../lib/types';
import { approvedCount } from '../lib/planStore';
import { Button } from './ui/button';

interface Props { plan?: CampaignPlan; opportunities: Opportunity[]; insights?: Insight[]; segments: SegmentProfile[] }

async function render(kind: 'csv' | 'md', p: Props): Promise<string> {
  const ex = await import('../lib/export');
  return kind === 'csv' ? ex.toCsv(p.plan!, p.opportunities, p.segments, p.insights) : ex.toMarkdown(p.plan!, p.opportunities, p.segments, p.insights);
}

export default function ExportButton(props: Props) {
  const [err, setErr] = useState('');
  const n = approvedCount(props.plan);

  async function download(kind: 'csv' | 'md') {
    setErr('');
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

  const item = 'cursor-pointer rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted';
  return (
    <div className="flex items-center gap-3">
      {err && <span role="alert" className="text-xs text-bad">{err}</span>}
      <Menu.Root>
        <Menu.Trigger asChild>
          <Button variant="outline" disabled={n < 1} title={n < 1 ? 'Approve at least one email to export' : undefined}>
            <Download /> Export approved ({n}) <ChevronDown />
          </Button>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content align="end" sideOffset={6} className="z-50 min-w-48 rounded-md border border-border bg-surface p-1 shadow-lg">
            <Menu.Item className={item} onSelect={() => download('csv')}>CSV</Menu.Item>
            <Menu.Item className={item} onSelect={() => download('md')}>Markdown</Menu.Item>
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}
