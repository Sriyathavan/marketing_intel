import { describe, it, expect } from 'vitest';
import { postProcess, checkCopy, suppressionNote, weekStart } from '@/lib/guardrails';
import { CTX, opp, profile, modelPlanFor, modelEmail } from './_planFixtures';

const o1 = opp(1);
const run = (mp = modelPlanFor([o1]), profiles = [profile('seg_family')]) =>
  postProcess(mp, { opportunities: [o1], profiles, context: CTX, now: new Date('2026-10-17T00:00:00Z') });

describe('postProcess', () => {
  it('assigns ids, status and metadata', () => {
    const p = run();
    expect(p.source).toBe('claude');
    expect(p.model).toBe('claude-sonnet-5-5');
    const s = p.sequences[0];
    expect(s.id).toBe(`seq_${o1.id}`);
    expect(s.emails[0].id).toBe(`em_${s.id}_1`);
    expect(s.emails.every((e) => e.status === 'proposed' && !e.editedByUser && e.segmentId === 'seg_family')).toBe(true);
  });
  it('strips unknown evidence ids and falls back with a warning', () => {
    const mp = modelPlanFor([o1]);
    mp.sequences[0].emails[0].evidenceIds = ['ev_bogus', o1.evidence[1].id];
    mp.sequences[0].emails[1].evidenceIds = ['ev_bogus'];
    const p = run(mp);
    expect(p.sequences[0].emails[0].evidenceIds).toEqual([o1.evidence[1].id]);
    expect(p.sequences[0].emails[1].evidenceIds.length).toBeGreaterThan(0);
    expect(p.sequences[0].emails[1].evidenceIds.every((i) => o1.evidence.some((e) => e.id === i))).toBe(true);
    expect(p.warnings.some((w) => /unknown evidence/.test(w))).toBe(true);
  });
  it('clamps dates into window and off blackouts', () => {
    const mp = modelPlanFor([o1], ['2026-10-01', '2027-03-01', '2026-12-25', '2027-01-01']);
    const p = run(mp, [profile('seg_family', { fatigueCapPerWeek: 3 })]);
    for (const e of p.sequences[0].emails) {
      expect(e.sendDate >= CTX.planStart && e.sendDate <= CTX.planEnd).toBe(true);
      expect(CTX.sendBlackouts).not.toContain(e.sendDate);
    }
  });
  it('enforces weekly fatigue cap per segment', () => {
    const mp = modelPlanFor([o1], ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']);
    const p = run(mp, [profile('seg_family', { fatigueCapPerWeek: 2 })]);
    const counts: Record<string, number> = {};
    for (const e of p.sequences[0].emails) counts[weekStart(e.sendDate)] = (counts[weekStart(e.sendDate)] ?? 0) + 1;
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(2);
    expect(p.warnings.some((w) => /weekly cap/.test(w))).toBe(true);
  });
  it('caps lapsed at 1 per week', () => {
    const o = opp(2, 'seg_lapsed');
    const p = postProcess(modelPlanFor([o], ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']),
      { opportunities: [o], profiles: [profile('seg_lapsed', { fatigueCapPerWeek: 3 })], context: CTX });
    const weeks = new Set(p.sequences[0].emails.map((e) => weekStart(e.sendDate)));
    expect(weeks.size).toBe(4);
  });
  it('flags sensitive copy terms', () => {
    const mp = modelPlanFor([o1]);
    mp.sequences[0].emails[0].subject = 'A fresh start after Divorce';
    const p = run(mp);
    expect(p.sequences[0].emails[0].guardrailFlags).toContain('copy_sensitive_term:divorce');
    expect(p.sequences[0].emails[0].guardrailFlags.some((f) => f.includes('fresh start after'))).toBe(true);
    expect(p.sequences[0].emails[1].guardrailFlags).toEqual([]);
  });
  it('writes suppressionNote', () => {
    expect(run().sequences[0].suppressionNote).toBe('4 of 40 segment members (10%) excluded for sensitive life events; used for suppression only');
  });
  it('drops sequences for unknown opportunities', () => {
    const mp = modelPlanFor([o1, opp(9)]);
    const p = run(mp);
    expect(p.sequences).toHaveLength(1);
    expect(p.warnings.some((w) => /unknown opportunity/.test(w))).toBe(true);
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
  it('unused import guard', () => { expect(modelEmail).toBeDefined(); });
});
