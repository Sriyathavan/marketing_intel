'use client';
import { useState } from 'react';
import type { Opportunity, SegmentProfile } from '../lib/types';
import EvidenceChip from './EvidenceChip';
import ScoreBreakdown, { ScoreBar } from './ScoreBreakdown';

interface Props {
  opportunities: Opportunity[]; segments: SegmentProfile[];
  checked: Set<string>; onToggle: (id: string) => void;
  onGenerate: () => void; loading: boolean;
}
const usd = (n: number) => '$' + n.toLocaleString('en-US');

export default function OpportunityList({ opportunities, segments, checked, onToggle, onGenerate, loading }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const count = checked.size;
  return (
    <aside className="col col-left" aria-label="Opportunities">
      <header className="col-head">
        <h2>Opportunities</h2>
        <p className="muted">Ranked by a transparent 5-factor score. Pick 3 to 5 to plan.</p>
      </header>
      <div className="col-scroll">
        {opportunities.map(o => {
          const seg = segments.find(s => s.id === o.segmentId);
          const isOpen = open === o.id;
          return (
            <article key={o.id} className={`card${checked.has(o.id) ? ' is-checked' : ''}`}>
              <div className="card-top">
                <label className="check">
                  <input type="checkbox" checked={checked.has(o.id)} onChange={() => onToggle(o.id)} aria-label={`Include ${o.title}`} />
                </label>
                <span className="rank">#{o.rank}</span>
                <span className="chip chip-seg">{seg?.name ?? o.segmentId}</span>
                <span className="badge-score" title="Total score out of 100">{o.score.total}</span>
              </div>
              <h3>{o.title}</h3>
              <p className="thesis">{o.thesis}</p>
              <ScoreBar score={o.score} />
              <div className="stats">
                <span><strong>{o.reachable}</strong> reachable</span>
                <span><strong>{usd(o.estRevenueUsd)}</strong> est. revenue</span>
              </div>
              <div className="chips">
                {o.evidence.slice(0, 4).map(e => <EvidenceChip key={e.id} evidence={e} />)}
              </div>
              <button type="button" className="link" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : o.id)}>
                {isOpen ? 'Hide score breakdown' : 'Why this score?'}
              </button>
              {isOpen && (
                <>
                  <ScoreBreakdown score={o.score} />
                  <div className="chips more">{o.evidence.slice(4).map(e => <EvidenceChip key={e.id} evidence={e} />)}</div>
                </>
              )}
            </article>
          );
        })}
      </div>
      <footer className="col-foot">
        <button type="button" className="btn btn-primary btn-block" disabled={count < 3 || count > 5 || loading} onClick={onGenerate}>
          {loading ? 'Claude is drafting...' : `Generate 90-day plan (${count})`}
        </button>
        {count < 3 && <p className="muted small">Select at least 3 opportunities.</p>}
      </footer>
    </aside>
  );
}
