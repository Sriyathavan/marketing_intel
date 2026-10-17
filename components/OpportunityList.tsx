'use client';
import { useState } from 'react';
import type { Opportunity, SegmentProfile } from '../lib/types';
import EvidenceChip from './EvidenceChip';
import ScoreBreakdown, { ScoreBar } from './ScoreBreakdown';

interface Props {
  opportunities: Opportunity[]; segments: SegmentProfile[];
  onGenerate: () => void; loading: boolean;
}

export default function OpportunityList({ opportunities, segments, onGenerate, loading }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <aside className="col col-left" aria-label="Opportunities">
      <header className="col-head">
        <h2>Opportunities</h2>
        <p className="muted">Ranked by a transparent 5-factor score.</p>
      </header>
      <div className="col-scroll">
        {opportunities.map(o => {
          const seg = segments.find(s => s.id === o.segmentId);
          const isOpen = open === o.id;
          return (
            <article key={o.id} className="card">
              <div className="card-top">
                <span className="rank">#{o.rank}</span>
                <span className="chip chip-seg">{seg?.name ?? o.segmentId}</span>
                <span className="badge-score" title="Total score out of 100">{o.score.total}</span>
              </div>
              <h3>{o.title}</h3>
              <p className="thesis">{o.thesis}</p>
              <ScoreBar score={o.score} />
              <div className="stats">
                <span><strong>{o.reachable}</strong> reachable</span>
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
        <button type="button" className="btn btn-primary btn-block" disabled={loading} onClick={onGenerate}>
          {loading ? 'Generating…' : 'Generate 90-day plan'}
        </button>
      </footer>
    </aside>
  );
}
