'use client';
import { useEffect, useMemo, useReducer, useRef } from 'react';
import type { CampaignPlan, ContextFile, Opportunity, SegmentProfile } from '../lib/types';
import { loadPersisted, planReducer, savePersisted } from '../lib/planStore';
import Calendar from './Calendar';
import CampaignDetail from './CampaignDetail';
import ExportButton from './ExportButton';

interface Props { plan: CampaignPlan; opportunities: Opportunity[]; segments: SegmentProfile[]; context: ContextFile }

/** Saved review state is only reused if it belongs to this exact plan. */
function sameShape(a: CampaignPlan, b: CampaignPlan): boolean {
  const ids = (p: CampaignPlan) => p.sequences.flatMap(s => s.emails.map(e => e.id)).join('|');
  return a.generatedAt === b.generatedAt && ids(a) === ids(b);
}

export default function CalendarApp({ plan: initial, opportunities, segments, context }: Props) {
  const [state, dispatch] = useReducer(planReducer, { status: 'ready', plan: initial });

  useEffect(() => {
    const saved = loadPersisted();
    if (saved && sameShape(saved, initial)) dispatch({ type: 'loaded', plan: saved });
  }, [initial]);
  // Skip while the plan is still the untouched server copy, or the first save would overwrite stored reviews.
  useEffect(() => { if (state.plan && state.plan !== initial) savePersisted(state.plan); }, [state.plan, initial]);

  const plan = state.plan!;
  const selected = state.selected;
  const seq = selected ? plan.sequences.find(s => s.id === selected.sequenceId) : undefined;
  // Radix only restores focus to its own trigger; the pills are not triggers, so remember the one that opened the panel.
  const opener = useRef<string>();
  const select = (sel: Parameters<typeof Calendar>[0]['selected']) => { opener.current = sel?.emailId; dispatch({ type: 'select', selection: sel }); };
  const returnFocus = (ev: Event) => {
    ev.preventDefault();
    if (opener.current) document.querySelector<HTMLElement>(`[data-email-id="${CSS.escape(opener.current)}"]`)?.focus();
  };
  const oppById = useMemo(() => new Map(opportunities.map(o => [o.id, o])), [opportunities]);

  return (
    <main className="mx-auto max-w-[1600px] px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {plan.sequences.reduce((n, s) => n + s.emails.length, 0)} proposed emails across {plan.sequences.length} sequences. Open an email to see why it was planned, then approve, edit or reject it.
          </p>
        </div>
        <ExportButton plan={plan} opportunities={opportunities} segments={segments} />
      </div>

      <Calendar plan={plan} segments={segments} selected={selected} onSelect={select} />

      <CampaignDetail
        sequence={seq} assumptions={plan.assumptions ?? []} onCloseAutoFocus={returnFocus} familyIndex={seq ? plan.sequences.indexOf(seq) : 0} emailId={selected?.emailId} context={context}
        opportunity={seq ? oppById.get(seq.opportunityId) : undefined}
        segment={seq ? segments.find(s => s.id === seq.segmentId) : undefined}
        onClose={() => dispatch({ type: 'select', selection: undefined })}
        onPickEmail={id => seq && dispatch({ type: 'select', selection: { sequenceId: seq.id, emailId: id } })}
        onEdit={(emailId, patch) => dispatch({ type: 'editEmail', emailId, patch })}
        onStatus={(emailId, status) => dispatch({ type: 'setStatus', emailId, status })}
        onSequenceStatus={status => seq && dispatch({ type: 'setSequenceStatus', sequenceId: seq.id, status })} />
    </main>
  );
}
