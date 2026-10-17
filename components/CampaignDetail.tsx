'use client';
import { useState } from 'react';
import { AlertTriangle, Check, Pencil, RotateCcw, ShieldCheck, X } from 'lucide-react';
import type { ContextFile, EmailCampaign, EmailSequence, Evidence, Insight, ReviewStatus, SegmentProfile } from '../lib/types';
import type { EmailEdit } from '../lib/planStore';
import { Sheet, SheetContent, SheetDescription, SheetDragHandle, SheetTitle } from './ui/sheet';
import { sequenceSpan, shortDate, spanSentence } from '../lib/sequenceSpan';
import { Button } from './ui/button';
import { Input, Label, Textarea } from './ui/field';
import { seqColor, STATUS_LABEL } from './Calendar';
import { cn } from '../lib/utils';
import { briefName, nameify } from '../lib/briefNames';

interface Props {
  sequence?: EmailSequence; emailId?: string; familyIndex?: number; assumptions: string[]; allSequences: EmailSequence[]; onCloseAutoFocus: (e: Event) => void;
  evidence: Record<string, Evidence>; insights: Insight[]; segment?: SegmentProfile; context: ContextFile;
  onClose: () => void; onPickEmail: (id: string) => void;
  onEdit: (emailId: string, patch: EmailEdit) => void;
  onStatus: (emailId: string, s: ReviewStatus) => void;
  onSequenceStatus: (s: ReviewStatus) => void;
}

const OFFER_LABEL: Record<string, string> = { content_story: 'Content story', early_access: 'Early access', promo_discount: 'Promo discount', new_trip_launch: 'New trip launch', bundle: 'Bundle' };
const STATUS_STYLE: Record<ReviewStatus, string> = {
  proposed: 'bg-[#fff6dc] text-[#7a5a00]', approved: 'bg-[#e1f4ea] text-[#1b6b47]', rejected: 'bg-[#fbe7e6] text-[#9a3532]',
};
function StatusBadge({ status }: { status: ReviewStatus }) {
  return <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLE[status])}>{STATUS_LABEL[status]}</span>;
}
const fmtDate = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

function EvidenceList({ ids, evidence }: { ids: string[]; evidence: Record<string, Evidence> }) {
  const found = ids.map(id => evidence[id]).filter((e): e is Evidence => !!e);
  if (!found.length) return null;
  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {found.map(ev => (
        <li key={ev.id} className="flex items-start justify-between gap-3 px-3 py-2 text-[13px]">
          <div className="min-w-0">
            <div className="font-medium">{ev.label}</div>
            <div className="text-xs text-muted-foreground">{ev.kind} · {ev.source.file} / {ev.source.ref}</div>
          </div>
          <div className="tabular shrink-0 font-semibold">{ev.value}{ev.unit ?? ''}</div>
        </li>
      ))}
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
  const { sequence: s, email, segment, context } = p;
  const insight = p.insights.find(i => i.id === s.opportunityId);
  const [editing, setEditing] = useState(false);
  const flagged = email.guardrailFlags.length > 0;
  const edit = (patch: EmailEdit) => p.onEdit(email.id, patch);

  const month = email.sendDate.slice(0, 7);
  const monthName = new Date(month + '-01T00:00:00Z').toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
  const segName = segment?.name ?? email.segmentId;
  const inMonth = p.allSequences.flatMap(q => q.emails).filter(e => e.segmentId === email.segmentId && e.sendDate.startsWith(month)).map(e => e.sendDate).sort();
  const gap = inMonth.length > 1 ? Math.round((Date.parse(inMonth[inMonth.length - 1]) - Date.parse(inMonth[0])) / 86_400_000 / (inMonth.length - 1)) : 0;
  const freq = `${inMonth.length} email${inMonth.length === 1 ? '' : 's'} across all sequences to ${segName} in ${monthName}${gap > 0 ? `, about every ${gap} day${gap === 1 ? '' : 's'}` : ''}`;

  return (
    <>
      <SheetDragHandle className="border-b border-border bg-muted/50 px-5 pb-3 pt-4 pr-12">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <i aria-hidden className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: seqColor(p.familyIndex ?? 0) }} />
          <SheetTitle className="min-w-0 break-words text-[13px] font-semibold">{s.name}</SheetTitle>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Email {email.step} of {s.emails.length}</span>
          <span aria-hidden>·</span><span>{fmtDate(email.sendDate)}</span>
          <StatusBadge status={email.status} />
          {email.editedByUser && <Tag>Edited</Tag>}
        </div>
        <SheetDescription id="detail-desc" className="sr-only">Review actions, audience, topic and rationale for this email.</SheetDescription>
      </SheetDragHandle>

      <div className="flex items-center gap-2 border-b border-border bg-surface px-5 py-3">
        <Button variant="ok" disabled={flagged || email.status === 'approved'} onClick={() => p.onStatus(email.id, 'approved')}><Check /> Approve</Button>
        <Button variant="outline" onClick={() => setEditing(e => !e)}><Pencil /> {editing ? 'Done' : 'Edit'}</Button>
        <Button variant="destructive" disabled={email.status === 'rejected'} onClick={() => p.onStatus(email.id, 'rejected')}><X /> Reject</Button>
        {email.status !== 'proposed' && <Button variant="ghost" className="ml-auto" onClick={() => p.onStatus(email.id, 'proposed')}><RotateCcw /> Reset</Button>}
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {flagged && (
          <div role="alert" className="flex gap-2 rounded-md border border-[#e0a100]/50 bg-[#fff6dc] p-3 text-[13px] text-[#6b4e00]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div><strong>Approval blocked by a copy guardrail.</strong> Edit the copy to clear it.
              <ul className="mt-1 list-disc pl-4">{email.guardrailFlags.map(f => <li key={f}><code>{f}</code></li>)}</ul></div>
          </div>
        )}

        <section aria-labelledby="d-aud">
          <h3 id="d-aud" className="mb-1 text-sm font-semibold">Audience and frequency</h3>
          <p className="text-[13px] font-medium">{freq}</p>
          <dl className="mt-1 divide-y divide-border">
            <Row k="Segment">{segName}{segment && <span className="text-muted-foreground"> · {segment.eligible} email-eligible of {segment.size}</span>}</Row>
            {s.audienceIds?.length > 0 && <Row k="Audiences"><span className="flex flex-wrap gap-1">{s.audienceIds.map(i => <Tag key={i}>{briefName(i)}</Tag>)}</span></Row>}
          </dl>
        </section>

        <section aria-labelledby="d-topic">
          <h3 id="d-topic" className="mb-1 text-sm font-semibold">Main topic</h3>
          <dl className="divide-y divide-border">
            <Row k="Angle">{insight?.title ?? s.goal}{insight && <span className="block text-xs text-muted-foreground">{insight.summary}</span>}</Row>
            <Row k="Offer">{OFFER_LABEL[email.offerType] ?? email.offerType}</Row>
            {!editing && <Row k="Creative">{nameify(email.creativeDirection)}</Row>}
            {!editing && <Row k="CTA">{email.cta.label} <span className="text-muted-foreground">to {email.cta.target}</span></Row>}
          </dl>
        </section>

        <section aria-label="Sequence emails">
          <h3 className="mb-2 text-sm font-semibold">Emails in this sequence</h3>
        <nav aria-label={`Emails in ${s.name}`} className="max-h-[220px] overflow-y-auto rounded-md border border-border bg-surface py-1">
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

        </section>

        <section aria-labelledby="d-copy">
          <h3 id="d-copy" className="mb-1 text-sm font-semibold">Email copy and send time</h3>
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
            </dl>
          )}
          {context.sendBlackouts.includes(email.sendDate) && <p className="mt-2 text-xs text-bad">This date is a send blackout.</p>}
        </section>

        <section aria-labelledby="d-why">
          <h3 id="d-why" className="sr-only">Rationale</h3>
          <H tag="Judgment">Why this email</H>
          <p className="mb-3 text-[13px] leading-relaxed">{nameify(email.rationale)}</p>
          <H tag="Sourced data">Evidence</H>
          <EvidenceList ids={email.evidenceIds} evidence={p.evidence} />
        </section>

        <section aria-labelledby="d-seq" className="rounded-lg bg-muted/60 p-4">
          <H tag="Judgment">Why this sequence</H>
          <p className="text-[13px] font-medium">{s.name}</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{nameify(s.goal)}</p>
          <p className="mt-2 text-[13px] leading-relaxed">{nameify(s.rationale)}</p>
          <p className="mt-3 text-[13px] font-medium">{spanSentence(sequenceSpan(s))}</p>
          {(s.audienceIds?.length > 0 || s.productLineIds?.length > 0) && (
            <dl className="mt-2 divide-y divide-border">
              {s.audienceIds?.length > 0 && <Row k="Audiences"><span className="flex flex-wrap gap-1">{s.audienceIds.map(i => <Tag key={i}>{briefName(i)}</Tag>)}</span></Row>}
              {s.productLineIds?.length > 0 && <Row k="Product lines"><span className="flex flex-wrap gap-1">{s.productLineIds.map(i => <Tag key={i}>{briefName(i)}</Tag>)}</span></Row>}
            </dl>
          )}
          <div className="mt-3"><EvidenceList ids={s.evidenceIds} evidence={p.evidence} /></div>
          {p.assumptions.length > 0 && (
            <div className="mt-3">
              <H tag="Judgment">Plan assumptions</H>
              <ul className="list-disc space-y-1 pl-4 text-[13px] leading-relaxed">{p.assumptions.map(a => <li key={a}>{nameify(a)}</li>)}</ul>
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
    </>
  );
}
