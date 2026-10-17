'use client';
import { useState } from 'react';
import { AlertTriangle, Check, Pencil, RotateCcw, ShieldCheck, X } from 'lucide-react';
import type { ContextFile, EmailCampaign, EmailSequence, Opportunity, ReviewStatus, SegmentProfile } from '../lib/types';
import type { EmailEdit } from '../lib/planStore';
import { Sheet, SheetContent, SheetDescription, SheetDragHandle, SheetTitle } from './ui/sheet';
import { sequenceSpan, shortDate, spanSentence } from '../lib/sequenceSpan';
import { Button } from './ui/button';
import { Input, Label, Textarea } from './ui/field';
import { FAMILY_SWATCH, STATUS_LABEL } from './Calendar';
import { cn } from '../lib/utils';

interface Props {
  sequence?: EmailSequence; emailId?: string; familyIndex?: number; assumptions: string[]; onCloseAutoFocus: (e: Event) => void;
  opportunity?: Opportunity; segment?: SegmentProfile; context: ContextFile;
  onClose: () => void; onPickEmail: (id: string) => void;
  onEdit: (emailId: string, patch: EmailEdit) => void;
  onStatus: (emailId: string, s: ReviewStatus) => void;
  onSequenceStatus: (s: ReviewStatus) => void;
}

const STATUS_STYLE: Record<ReviewStatus, string> = {
  proposed: 'bg-[#fff6dc] text-[#7a5a00]', approved: 'bg-[#e1f4ea] text-[#1b6b47]', rejected: 'bg-[#fbe7e6] text-[#9a3532]',
};
function StatusBadge({ status }: { status: ReviewStatus }) {
  return <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLE[status])}>{STATUS_LABEL[status]}</span>;
}
const fmtDate = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function EvidenceList({ ids, opportunity }: { ids: string[]; opportunity?: Opportunity }) {
  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {ids.map(id => {
        const ev = opportunity?.evidence.find(e => e.id === id);
        return (
          <li key={id} className="flex items-start justify-between gap-3 px-3 py-2 text-[13px]">
            <div className="min-w-0">
              <div className="font-medium">{ev?.label ?? id}</div>
              <div className="text-xs text-muted-foreground">{ev ? `${ev.kind} · ${ev.source.file} / ${ev.source.ref}` : 'Evidence record not found'}</div>
            </div>
            {ev && <div className="tabular shrink-0 font-semibold">{ev.value}{ev.unit ?? ''}</div>}
          </li>
        );
      })}
    </ul>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-[104px_1fr] gap-3 py-2 text-[13px]"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 break-words">{children}</dd></div>;
}
function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded border border-border px-1.5 py-px text-[11px] font-medium text-muted-foreground">{children}</span>;
}
function H({ children, tag }: { children: React.ReactNode; tag?: string }) {
  return <div className="mb-2 flex items-center gap-2"><h3 className="text-sm font-semibold">{children}</h3>{tag && <Tag>{tag}</Tag>}</div>;
}

export default function CampaignDetail(p: Props) {
  const s = p.sequence;
  const email = s ? s.emails.find(e => e.id === p.emailId) ?? s.emails[0] : undefined;
  return (
    <Sheet modal={false} open={!!s} onOpenChange={o => { if (!o) p.onClose(); }}>
      <SheetContent aria-describedby="detail-desc" onCloseAutoFocus={p.onCloseAutoFocus}>
        {s && email && <Body key={email.id} {...p} sequence={s} email={email} />}
      </SheetContent>
    </Sheet>
  );
}

function Body(p: Props & { sequence: EmailSequence; email: EmailCampaign }) {
  const { sequence: s, email, opportunity, segment, context } = p;
  const [editing, setEditing] = useState(false);
  const flagged = email.guardrailFlags.length > 0;
  const edit = (patch: EmailEdit) => p.onEdit(email.id, patch);

  return (
    <>
      <SheetDragHandle className="border-b border-border bg-muted/50 px-5 pb-4 pt-4 pr-12">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <i aria-hidden className={cn('size-3 shrink-0 rounded-sm', FAMILY_SWATCH[(p.familyIndex ?? 0) % FAMILY_SWATCH.length])} />
          <span className="min-w-0 break-words">{s.name}</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Email {email.step} of {s.emails.length}</span>
          <span aria-hidden> · </span>{fmtDate(email.sendDate)}
        </div>
        <SheetTitle className="mt-3 text-lg font-semibold leading-snug tracking-tight">{email.subject}</SheetTitle>
        <SheetDescription id="detail-desc" className="sr-only">Details and rationale for this email, with approve, edit and reject actions.</SheetDescription>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={email.status} />
          {email.editedByUser && <Tag>Edited</Tag>}
        </div>
        <nav aria-label={`Emails in ${s.name}`} className="mt-3 max-h-[176px] overflow-y-auto rounded-md border border-border bg-surface py-1">
          <ol>
            {s.emails.map(e => {
              const cur = e.id === email.id;
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => p.onPickEmail(e.id)} aria-current={cur ? 'step' : undefined}
                    className={cn('grid w-full cursor-pointer grid-cols-[18px_88px_minmax(0,1fr)] items-center gap-2 px-2.5 py-1.5 text-left text-xs',
                      cur ? 'bg-accent-soft font-semibold text-foreground' : 'text-muted-foreground hover:bg-muted')}>
                    <span aria-hidden className={cn('grid size-[18px] place-items-center rounded-full text-[10px] font-semibold tabular',
                      cur ? 'bg-accent text-accent-foreground' : 'border border-border-strong')}>{e.step}</span>
                    <span className="tabular">{shortDate(e.sendDate)}</span>
                    <span className="truncate" title={e.subject}>{e.subject}<span className="sr-only">, {STATUS_LABEL[e.status]}</span></span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </SheetDragHandle>

      <div className="flex-1 space-y-7 overflow-y-auto px-5 py-5">
        {flagged && (
          <div role="alert" className="flex gap-2 rounded-md border border-[#e0a100]/50 bg-[#fff6dc] p-3 text-[13px] text-[#6b4e00]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div><strong>Approval blocked by a copy guardrail.</strong> Edit the copy to clear it.
              <ul className="mt-1 list-disc pl-4">{email.guardrailFlags.map(f => <li key={f}><code>{f}</code></li>)}</ul></div>
          </div>
        )}

        <section aria-labelledby="d-details">
          <h3 id="d-details" className="mb-1 text-sm font-semibold">Details</h3>
          {editing ? (
            <div className="space-y-3 pt-2">
              <Label>Subject <span className={cn('font-normal', email.subject.length > 70 && 'text-bad')}>{email.subject.length}/70</span>
                <Input value={email.subject} onChange={e => edit({ subject: e.target.value })} /></Label>
              <Label>Preheader <span className={cn('font-normal', email.preheader.length > 110 && 'text-bad')}>{email.preheader.length}/110</span>
                <Input value={email.preheader} onChange={e => edit({ preheader: e.target.value })} /></Label>
              <div className="grid grid-cols-2 gap-3">
                <Label>Send date
                  <Input type="date" value={email.sendDate} min={context.planStart} max={context.planEnd}
                    onChange={e => e.target.value && edit({ sendDate: e.target.value })} /></Label>
                <Label>Local time
                  <Input type="time" value={email.sendTimeLocal} onChange={e => e.target.value && edit({ sendTimeLocal: e.target.value })} /></Label>
              </div>
              <Label>Creative direction
                <Textarea rows={4} value={email.creativeDirection} onChange={e => edit({ creativeDirection: e.target.value })} /></Label>
              <div className="grid grid-cols-2 gap-3">
                <Label>CTA label
                  <Input value={email.cta.label} onChange={e => edit({ cta: { label: e.target.value, target: email.cta.target } })} /></Label>
                <Label>CTA target
                  <Input value={email.cta.target} onChange={e => edit({ cta: { label: email.cta.label, target: e.target.value } })} /></Label>
              </div>
            </div>
          ) : (
            <dl className="divide-y divide-border">
              <Row k="Subject">{email.subject}</Row>
              <Row k="Preheader">{email.preheader}</Row>
              <Row k="Send">{fmtDate(email.sendDate)}, {email.sendTimeLocal} recipient-local</Row>
              <Row k="Segment">{segment?.name ?? email.segmentId}{segment && <span className="text-muted-foreground"> · {segment.eligible} eligible</span>}</Row>
              <Row k="CTA">{email.cta.label} <span className="text-muted-foreground">→ {email.cta.target}</span></Row>
              <Row k="Creative">{email.creativeDirection}</Row>
            </dl>
          )}
          {context.sendBlackouts.includes(email.sendDate) && <p className="mt-2 text-xs text-bad">This date is a send blackout.</p>}
        </section>

        <section aria-labelledby="d-why">
          <h3 id="d-why" className="sr-only">Rationale</h3>
          <H tag="Judgment">Why this email</H>
          <p className="mb-3 text-[13px] leading-relaxed">{email.rationale}</p>
          <H tag="Sourced data">Evidence</H>
          <EvidenceList ids={email.evidenceIds} opportunity={opportunity} />
        </section>

        <section aria-labelledby="d-seq" className="rounded-lg bg-muted/60 p-4">
          <H tag="Judgment">Why this sequence</H>
          <p className="text-[13px] font-medium">{s.name}</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{s.goal}</p>
          <p className="mt-2 text-[13px] leading-relaxed">{s.rationale}</p>
          <p className="mt-3 text-[13px] font-medium">{spanSentence(sequenceSpan(s))}</p>
          {(s.audienceIds?.length > 0 || s.productLineIds?.length > 0) && (
            <dl className="mt-2 divide-y divide-border">
              {s.audienceIds?.length > 0 && <Row k="Audiences"><span className="flex flex-wrap gap-1">{s.audienceIds.map(i => <Tag key={i}>{i}</Tag>)}</span></Row>}
              {s.productLineIds?.length > 0 && <Row k="Product lines"><span className="flex flex-wrap gap-1">{s.productLineIds.map(i => <Tag key={i}>{i}</Tag>)}</span></Row>}
            </dl>
          )}
          <div className="mt-3"><EvidenceList ids={s.evidenceIds} opportunity={opportunity} /></div>
          {p.assumptions.length > 0 && (
            <div className="mt-3">
              <H tag="Judgment">Plan assumptions</H>
              <ul className="list-disc space-y-1 pl-4 text-[13px] leading-relaxed">{p.assumptions.map(a => <li key={a}>{a}</li>)}</ul>
            </div>
          )}
          <p className="mt-3 flex gap-2 text-xs text-muted-foreground"><ShieldCheck className="mt-px size-4 shrink-0" />{s.suppressionNote}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => p.onSequenceStatus('approved')}>Approve all</Button>
            <Button variant="outline" size="sm" onClick={() => p.onSequenceStatus('rejected')}>Reject all</Button>
            <Button variant="ghost" size="sm" onClick={() => p.onSequenceStatus('proposed')}>Reset all</Button>
          </div>
        </section>
      </div>

      <footer className="flex items-center gap-2 border-t border-border bg-surface px-5 py-3">
        <Button variant="ok" disabled={flagged || email.status === 'approved'} onClick={() => p.onStatus(email.id, 'approved')}><Check /> Approve</Button>
        <Button variant="outline" onClick={() => setEditing(e => !e)}><Pencil /> {editing ? 'Done' : 'Edit'}</Button>
        <Button variant="destructive" disabled={email.status === 'rejected'} onClick={() => p.onStatus(email.id, 'rejected')}><X /> Reject</Button>
        {email.status !== 'proposed' && <Button variant="ghost" className="ml-auto" onClick={() => p.onStatus(email.id, 'proposed')}><RotateCcw /> Reset</Button>}
      </footer>
    </>
  );
}
