import { describe, it, expect } from 'vitest';
import { planReducer, initialState, loadPersisted, savePersisted, approvedCount, STORAGE_KEY } from '../lib/planStore';
import type { CampaignPlan, EmailCampaign } from '../lib/types';

const email = (n: number, flags: string[] = []): EmailCampaign => ({
  id: `em_seq_a_${n}`, sequenceId: 'seq_a', opportunityId: 'opp_a', segmentId: 'seg_family', step: n,
  sendDate: '2026-11-03', sendTimeLocal: '19:00', subject: 's', preheader: 'p', creativeDirection: 'c',
  cta: { label: 'Go', target: '/x' }, offerType: 'bundle', rationale: 'r', evidenceIds: ['ev_1'],
  status: 'proposed', editedByUser: false, guardrailFlags: flags,
});
const plan = (): CampaignPlan => ({
  planStart: '2026-11-02', planEnd: '2027-01-30', generatedAt: 'x', source: 'cache', model: null, warnings: [], assumptions: [],
  sequences: [{ id: 'seq_a', opportunityId: 'opp_a', segmentId: 'seg_family', name: 'A', goal: 'g', startDate: '2026-11-03', endDate: '2026-11-10', durationDays: 8, audienceIds: [], productLineIds: [],
    cadence: { emailsPerWeek: 1, spacingDays: 7 }, rationale: 'r', evidenceIds: [], suppressionNote: '',
    emails: [email(1), email(2, ['copy_sensitive_term:grief'])] }],
});
const ready = () => planReducer(initialState, { type: 'loaded', plan: plan() });
const mem = () => { const m = new Map<string, string>(); return { m, s: {
  getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } }; };

describe('planStore', () => {
  it('loading then loaded', () => {
    expect(planReducer(initialState, { type: 'loading' }).status).toBe('loading');
    expect(ready().status).toBe('ready');
  });
  it('edit sets editedByUser and merges cta', () => {
    const s = planReducer(ready(), { type: 'editEmail', emailId: 'em_seq_a_1', patch: { subject: 'new', cta: { label: 'L', target: '/y' } } });
    const e = s.plan!.sequences[0].emails[0];
    expect(e.subject).toBe('new'); expect(e.editedByUser).toBe(true); expect(e.cta.target).toBe('/y');
    expect(s.plan!.sequences[0].emails[1].editedByUser).toBe(false);
  });
  it('approve blocked by guardrail flags, reject allowed', () => {
    let s = planReducer(ready(), { type: 'setStatus', emailId: 'em_seq_a_2', status: 'approved' });
    expect(s.plan!.sequences[0].emails[1].status).toBe('proposed');
    s = planReducer(s, { type: 'setStatus', emailId: 'em_seq_a_2', status: 'rejected' });
    expect(s.plan!.sequences[0].emails[1].status).toBe('rejected');
  });
  it('editing copy re-checks sensitive terms', () => {
    let s = planReducer(ready(), { type: 'editEmail', emailId: 'em_seq_a_2', patch: { subject: 'Plain subject' } });
    expect(s.plan!.sequences[0].emails[1].guardrailFlags).toEqual([]);
    s = planReducer(s, { type: 'setStatus', emailId: 'em_seq_a_2', status: 'approved' });
    expect(s.plan!.sequences[0].emails[1].status).toBe('approved');
    s = planReducer(s, { type: 'editEmail', emailId: 'em_seq_a_2', patch: { preheader: 'after your divorce' } });
    const e = s.plan!.sequences[0].emails[1];
    expect(e.guardrailFlags).toEqual(['copy_sensitive_term:divorce']);
    expect(e.status).toBe('proposed');
  });
  it('sequence approve all skips flagged', () => {
    const s = planReducer(ready(), { type: 'setSequenceStatus', sequenceId: 'seq_a', status: 'approved' });
    expect(approvedCount(s.plan)).toBe(1);
    const r = planReducer(s, { type: 'setSequenceStatus', sequenceId: 'seq_a', status: 'proposed' });
    expect(approvedCount(r.plan)).toBe(0);
  });
  it('select', () => {
    const s = planReducer(ready(), { type: 'select', selection: { sequenceId: 'seq_a', emailId: 'em_seq_a_1' } });
    expect(s.selected?.emailId).toBe('em_seq_a_1');
  });
  it('error keeps existing plan', () => {
    expect(planReducer(ready(), { type: 'error', message: 'x' }).status).toBe('ready');
    expect(planReducer(initialState, { type: 'error', message: 'x' }).status).toBe('error');
  });
  it('persists and restores', () => {
    const { m, s } = mem();
    savePersisted(plan(), s);
    expect(m.has(STORAGE_KEY)).toBe(true);
    expect(loadPersisted(s)?.sequences[0].id).toBe('seq_a');
    savePersisted(undefined, s);
    expect(loadPersisted(s)).toBeNull();
    m.set(STORAGE_KEY, '{bad'); expect(loadPersisted(s)).toBeNull();
  });
});
