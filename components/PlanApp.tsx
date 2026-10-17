'use client';
import { useEffect, useMemo, useReducer, useRef } from 'react';
import type { CampaignPlan, ContextFile, Opportunity, PlanResponse, SegmentProfile } from '../lib/types';
import { initialState, loadPersisted, planReducer, savePersisted } from '../lib/planStore';
import OpportunityList from './OpportunityList';
import Calendar from './Calendar';
import CampaignDetail from './CampaignDetail';
import ExportButton from './ExportButton';

interface Props { opportunities: Opportunity[]; segments: SegmentProfile[]; context: ContextFile }

async function generate(ids: string[]): Promise<CampaignPlan> {
  const res = await fetch('/api/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ opportunityIds: ids }) });
  if (!res.ok) {
    const j = await res.json().catch(() => null);
    throw new Error(j?.error ?? `Request failed (${res.status})`);
  }
  return ((await res.json()) as PlanResponse).plan;
}

export default function PlanApp({ opportunities, segments, context }: Props) {
  const [state, dispatch] = useReducer(planReducer, initialState);

  const hydrated = useRef(false);
  useEffect(() => {
    const saved = loadPersisted();
    if (saved) dispatch({ type: 'loaded', plan: saved });
    hydrated.current = true;
  }, []);
  useEffect(() => { if (hydrated.current && state.status !== 'loading') savePersisted(state.plan); }, [state.plan, state.status]);

  async function onGenerate() {
    dispatch({ type: 'loading' });
    try { dispatch({ type: 'loaded', plan: await generate(opportunities.map(o => o.id)) }); }
    catch (e) { dispatch({ type: 'error', message: e instanceof Error ? e.message : 'Plan generation failed' }); }
  }

  const { plan, selected } = state;
  const seq = plan && selected ? plan.sequences.find(s => s.id === selected.sequenceId) : undefined;
  const oppById = useMemo(() => new Map(opportunities.map(o => [o.id, o])), [opportunities]);

  return (
    <div className={`app${seq ? ' has-detail' : ''}`}>
      <header className="topbar">
        <div className="brand"><span className="logo" aria-hidden>◈</span><h1>Marketing Intelligence Engine</h1></div>
        <span className="muted small">{context.planStart} to {context.planEnd} · 90 days</span>
        <span className="spacer" />
        <ExportButton plan={plan} opportunities={opportunities} segments={segments} />
      </header>
      <main className="layout">
        <OpportunityList opportunities={opportunities} segments={segments} loading={state.status === 'loading'} onGenerate={onGenerate} />
        <section className="col col-center">
          {state.error && <div className="banner banner-err" role="alert">{state.error}</div>}
          {state.status === 'loading' && (
            <div className="empty"><div className="spinner" /><h2>Generating…</h2></div>
          )}
          {state.status !== 'loading' && !plan && (
            <div className="empty">
              <div className="empty-art" aria-hidden>▦</div>
              <h2>Your 90-day calendar</h2>
              <p className="muted">Generate a plan from the scored opportunities on the left. Every email is explained and can be edited, approved or rejected.</p>
            </div>
          )}
          {plan && state.status !== 'loading' && (
            <div className="col-scroll">
              <Calendar plan={plan} context={context} selected={selected} onSelect={s => dispatch({ type: 'select', selection: s })} />
            </div>
          )}
        </section>
        {seq && plan && (
          <CampaignDetail sequence={seq} emailId={selected?.emailId}
            opportunity={oppById.get(seq.opportunityId)} segment={segments.find(s => s.id === seq.segmentId)} context={context}
            onClose={() => dispatch({ type: 'select', selection: undefined })}
            onPickEmail={id => dispatch({ type: 'select', selection: { sequenceId: seq.id, emailId: id } })}
            onEdit={(emailId, patch) => dispatch({ type: 'editEmail', emailId, patch })}
            onStatus={(emailId, status) => dispatch({ type: 'setStatus', emailId, status })}
            onSequenceStatus={status => dispatch({ type: 'setSequenceStatus', sequenceId: seq.id, status })} />
        )}
      </main>
    </div>
  );
}
