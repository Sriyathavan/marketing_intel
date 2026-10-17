import { describe, it, expect } from 'vitest';
import { postProcess, checkCopy, suppressionNote, weekStart, deriveSchedule } from '@/lib/guardrails';
import { CTX, profile, planned } from './_planFixtures';

const run = (seqs = [planned()], profiles = [profile('seg_family')]) =>
  postProcess(seqs, { profiles, context: CTX, model: 'm', assumptions: ['a1'], now: new Date('2026-10-17T00:00:00Z') });

describe('postProcess', () => {
  it('assigns ids, status, brief ids and metadata', () => {
    const p = run();
    expect(p.source).toBe('claude');
    expect(p.model).toBe('m');
    expect(p.assumptions).toEqual(['a1']);
    const s = p.sequences[0];
    expect(s.id).toBe('seq_s1');
    expect(s.opportunityId).toBe('ins_one');
    expect(s.audienceIds).toEqual(['A3']);
    expect(s.productLineIds).toEqual(['PL1']);
    expect(s.emails[0].id).toBe('em_seq_s1_1');
    expect(s.emails.every((e) => e.status === 'proposed' && !e.editedByUser && e.segmentId === 'seg_family')).toBe(true);
  });
  it('derives start, end, duration and cadence from send dates', () => {
    const s = run().sequences[0]; // 11-03, 11-12, 11-24, 12-08
    expect(s.startDate).toBe('2026-11-03');
    expect(s.endDate).toBe('2026-12-08');
    expect(s.durationDays).toBe(36);
    expect(s.cadence).toEqual({ emailsPerWeek: 0.8, spacingDays: 11.7 });
  });
  it('deriveSchedule handles a single email', () => {
    expect(deriveSchedule([{ sendDate: '2026-11-03' }])).toMatchObject({ durationDays: 1, cadence: { emailsPerWeek: 7, spacingDays: 0 } });
  });
  it('strips evidence ids outside the sequence insights and falls back', () => {
    const ps = planned();
    ps.model.emails[0].evidenceIds = ['ev_bogus', 'ev_b'];
    ps.model.emails[1].evidenceIds = ['ev_bogus'];
    const p = run([ps]);
    expect(p.sequences[0].emails[0].evidenceIds).toEqual(['ev_b']);
    expect(p.sequences[0].emails[1].evidenceIds).toEqual(['ev_a', 'ev_b']);
    expect(p.warnings.some((w) => /unknown evidence/.test(w))).toBe(true);
  });
  it('clamps dates into window and off blackouts', () => {
    const p = run([planned('s1', ['2026-10-01', '2027-03-01', '2026-12-25', '2026-11-26'])], [profile('seg_family', { fatigueCapPerWeek: 3 })]);
    for (const e of p.sequences[0].emails) {
      expect(e.sendDate >= CTX.planStart && e.sendDate <= CTX.planEnd).toBe(true);
      expect(CTX.sendBlackouts).not.toContain(e.sendDate);
    }
  });
  it('enforces weekly fatigue cap per segment', () => {
    const p = run([planned('s1', ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'])], [profile('seg_family', { fatigueCapPerWeek: 2 })]);
    const counts: Record<string, number> = {};
    for (const e of p.sequences[0].emails) counts[weekStart(e.sendDate)] = (counts[weekStart(e.sendDate)] ?? 0) + 1;
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(2);
    expect(p.warnings.some((w) => /weekly cap/.test(w))).toBe(true);
  });
  it('caps lapsed at 1 per week', () => {
    const p = run([planned('s1', ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'], { segmentId: 'seg_lapsed' })], [profile('seg_lapsed', { fatigueCapPerWeek: 3 })]);
    expect(new Set(p.sequences[0].emails.map((e) => weekStart(e.sendDate))).size).toBe(4);
  });
  it('flags sensitive copy terms and PL4 discounts', () => {
    const ps = planned('s1', undefined, { productLineIds: ['PL4'] });
    ps.model.emails[0].subject = 'A fresh start after Divorce';
    ps.model.emails[1].offerType = 'promo_discount';
    const e = run([ps]).sequences[0].emails;
    expect(e[0].guardrailFlags).toContain('copy_sensitive_term:divorce');
    expect(e[1].guardrailFlags).toEqual(['pl4_never_discounted']);
    expect(e[2].guardrailFlags).toEqual([]);
  });
  it('writes suppressionNote', () => {
    expect(run().sequences[0].suppressionNote).toBe('4 of 40 segment members (10%) excluded for sensitive life events; used for suppression only');
  });
  it('carries sequence warnings and warns on uncovered weeks and A3/A1 share', () => {
    const ps = planned();
    ps.model.warnings = ['conflict X'];
    const p = run([ps]);
    expect(p.warnings).toContain('Seq s1: conflict X');
    expect(p.warnings.some((w) => /No campaign scheduled in the week of 2026-11-09|week of 2026-11-16/.test(w))).toBe(true);
    const lowShare = run([planned('s1', undefined, { audienceIds: ['A2'] })]);
    expect(lowShare.warnings.some((w) => /0% of campaigns/.test(w))).toBe(true);
    expect(p.warnings.some((w) => /% of campaigns/.test(w))).toBe(true);
  });
});

describe('helpers', () => {
  it('checkCopy matches spec regex terms', () => {
    expect(checkCopy({ subject: 'Recovering from loss', preheader: '', creativeDirection: 'your age', rationale: '' }))
      .toEqual(['copy_sensitive_term:recovering from', 'copy_sensitive_term:your age']);
    expect(checkCopy({ subject: 'Ski deals', preheader: '', creativeDirection: '', rationale: '' })).toEqual([]);
  });
  it('suppressionNote handles empty segment', () => {
    expect(suppressionNote({ size: 0, suppressedSensitive: 0 })).toContain('0 of 0');
  });
});
