'use client';
import type { EmailCampaign, EmailSequence, Opportunity, ReviewStatus, SegmentProfile, ContextFile } from '../lib/types';
import type { EmailEdit } from '../lib/planStore';
import EvidenceChip from './EvidenceChip';
import ReviewControls, { StatusBadge } from './ReviewControls';

interface Props {
  sequence: EmailSequence; seqIndex: number; emailId?: string;
  opportunity?: Opportunity; segment?: SegmentProfile; context: ContextFile;
  onClose: () => void; onPickEmail: (id: string) => void;
  onEdit: (emailId: string, patch: EmailEdit) => void;
  onStatus: (emailId: string, s: ReviewStatus) => void;
  onSequenceStatus: (s: ReviewStatus) => void;
}

export default function CampaignDetail(p: Props) {
  const { sequence: s, opportunity, segment } = p;
  const email: EmailCampaign = s.emails.find(e => e.id === p.emailId) ?? s.emails[0];
  const ev = (id: string) => opportunity?.evidence.find(e => e.id === id);
  const eligible = segment?.eligible;

  return (
    <aside className="col col-right" aria-label="Campaign detail">
      <header className={`detail-head seq-${p.seqIndex % 5}`}>
        <div className="detail-head-row">
          <span className="seq-swatch" />
          <h2>{s.name}</h2>
          <button type="button" className="icon-btn" onClick={p.onClose} aria-label="Close detail">✕</button>
        </div>
        <p className="goal">{s.goal}</p>
        <div className="chips">
          <span className="chip chip-seg">{segment?.name ?? s.segmentId}</span>
          {eligible !== undefined && <span className="chip chip-muted">{eligible} eligible</span>}
          <span className="chip chip-muted">{s.cadence.emailsPerWeek}/week · every {s.cadence.spacingDays} days</span>
        </div>
      </header>

      <div className="col-scroll">
        <section className="block">
          <h4>Why this sequence</h4>
          <p>{s.rationale}</p>
          <div className="chips">{s.evidenceIds.map(id => <EvidenceChip key={id} evidence={ev(id)} fallbackId={id} />)}</div>
          <p className="suppress small">{s.suppressionNote}</p>
          <div className="btn-row">
            <button type="button" className="btn btn-ok btn-sm" onClick={() => p.onSequenceStatus('approved')}>Approve all</button>
            <button type="button" className="btn btn-bad btn-sm" onClick={() => p.onSequenceStatus('rejected')}>Reject all</button>
            <button type="button" className="btn btn-sm" onClick={() => p.onSequenceStatus('proposed')}>Reset all</button>
          </div>
        </section>

        <nav className="stepper" aria-label="Emails in sequence">
          {s.emails.map(e => (
            <button type="button" key={e.id} className={`step st-${e.status}${e.id === email.id ? ' active' : ''}`} onClick={() => p.onPickEmail(e.id)}
              aria-current={e.id === email.id}>
              <b>{e.step}</b><span>{e.sendDate.slice(5)}</span>
              {e.guardrailFlags.length > 0 && <em aria-label="flagged">⚠</em>}
            </button>
          ))}
        </nav>

        <section className="block" key={email.id}>
          <div className="email-title"><h4>Email {email.step} of {s.emails.length}</h4><StatusBadge status={email.status} /></div>
          <ReviewControls email={email} onStatus={st => p.onStatus(email.id, st)} />

          <div className="form">
            <label>Subject <span className={`count${email.subject.length > 70 ? ' over' : ''}`}>{email.subject.length}/70</span>
              <input value={email.subject} onChange={e => p.onEdit(email.id, { subject: e.target.value })} />
            </label>
            <label>Preheader <span className={`count${email.preheader.length > 110 ? ' over' : ''}`}>{email.preheader.length}/110</span>
              <input value={email.preheader} onChange={e => p.onEdit(email.id, { preheader: e.target.value })} />
            </label>
            <div className="two">
              <label>Send date
                <input type="date" value={email.sendDate} min={p.context.planStart} max={p.context.planEnd}
                  onChange={e => e.target.value && p.onEdit(email.id, { sendDate: e.target.value })} />
              </label>
              <label>Local time
                <input type="time" value={email.sendTimeLocal} onChange={e => e.target.value && p.onEdit(email.id, { sendTimeLocal: e.target.value })} />
              </label>
            </div>
            {p.context.sendBlackouts.includes(email.sendDate) && <p className="err small">This date is a send blackout.</p>}
            <label>Creative direction
              <textarea rows={3} value={email.creativeDirection} onChange={e => p.onEdit(email.id, { creativeDirection: e.target.value })} />
            </label>
            <div className="two">
              <label>CTA label
                <input value={email.cta.label} onChange={e => p.onEdit(email.id, { cta: { label: e.target.value, target: email.cta.target } })} />
              </label>
              <label>CTA target
                <input value={email.cta.target} onChange={e => p.onEdit(email.id, { cta: { label: email.cta.label, target: e.target.value } })} />
              </label>
            </div>
          </div>

          <div className="rationale">
            <h4>Rationale</h4>
            <p>{email.rationale}</p>
            <div className="chips">{email.evidenceIds.map(id => <EvidenceChip key={id} evidence={ev(id)} fallbackId={id} />)}</div>
          </div>
        </section>
      </div>
    </aside>
  );
}
