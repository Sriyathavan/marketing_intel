'use client';
import type { EmailCampaign, ReviewStatus } from '../lib/types';

export function StatusBadge({ status }: { status: ReviewStatus }) {
  return <span className={`status status-${status}`}>{status}</span>;
}

interface Props { email: EmailCampaign; onStatus: (s: ReviewStatus) => void }

export default function ReviewControls({ email, onStatus }: Props) {
  const flagged = email.guardrailFlags.length > 0;
  return (
    <div className="review">
      {flagged && (
        <div className="banner banner-warn" role="alert">
          <strong>Guardrail flag: approval blocked.</strong> Editing the copy re-runs the check.
          <ul>{email.guardrailFlags.map(f => <li key={f}><code>{f}</code></li>)}</ul>
        </div>
      )}
      <div className="review-row">
        <StatusBadge status={email.status} />
        {email.editedByUser && <span className="chip chip-muted">edited</span>}
        <span className="spacer" />
        <button type="button" className="btn btn-ok" disabled={flagged || email.status === 'approved'} onClick={() => onStatus('approved')}>Approve</button>
        <button type="button" className="btn btn-bad" disabled={email.status === 'rejected'} onClick={() => onStatus('rejected')}>Reject</button>
        <button type="button" className="btn" disabled={email.status === 'proposed'} onClick={() => onStatus('proposed')}>Reset</button>
      </div>
    </div>
  );
}
