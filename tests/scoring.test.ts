import { describe, it, expect } from 'vitest';
import { WEIGHTS, EFFORT, scoreOpportunity, clamp01, round1 } from '../lib/scoring';
import type { ScoringInput } from '../lib/types';

const base: ScoringInput = {
  yoyPct: 30, recentSlopePct: 10, affinityShare: 0.5, meanClickRate: 0.05, avgSeasonIdx: 1.1, bookingWindowShare: 0.4,
  reachable: 20, meanAov: 1500, offerType: 'promo_discount', fatigueShare: 0.2, inventoryConstrained: false,
};
const f = (b: ReturnType<typeof scoreOpportunity>, k: string) => b.factors.find((x) => x.key === k)!;

describe('scoring', () => {
  it('weights sum to 1', () => {
    expect(Object.values(WEIGHTS).reduce((s, w) => s + w, 0)).toBeCloseTo(1, 10);
  });
  it('is deterministic and in rubric order', () => {
    expect(scoreOpportunity(base)).toEqual(scoreOpportunity({ ...base }));
    expect(scoreOpportunity(base).factors.map((x) => x.key)).toEqual(['trendMomentum', 'segmentFit', 'seasonalTiming', 'revenuePotential', 'effortRisk']);
  });
  it('factor scores stay within 0-100, including extremes', () => {
    const hi = scoreOpportunity({ ...base, yoyPct: 500, recentSlopePct: 500, affinityShare: 1, meanClickRate: 1, avgSeasonIdx: 5, bookingWindowShare: 1, reachable: 1e6 });
    const lo = scoreOpportunity({ ...base, yoyPct: -80, recentSlopePct: -80, affinityShare: 0, meanClickRate: 0, avgSeasonIdx: 0, bookingWindowShare: 0, reachable: 0 });
    for (const b of [hi, lo, scoreOpportunity(base)]) for (const x of b.factors) { expect(x.score).toBeGreaterThanOrEqual(0); expect(x.score).toBeLessThanOrEqual(100); }
    expect(f(hi, 'trendMomentum').score).toBe(100);
    expect(f(lo, 'trendMomentum').score).toBe(0);
    expect(f(hi, 'revenuePotential').score).toBe(100);
  });
  it('total equals weighted sum within rounding', () => {
    const b = scoreOpportunity(base);
    const sum = b.factors.reduce((s, x) => s + x.weight * x.score, 0);
    expect(Math.abs(b.total - sum)).toBeLessThan(0.1);
    expect(b.factors.reduce((s, x) => s + x.contribution, 0)).toBeCloseTo(b.total, 0);
  });
  it('matches the spec formula for a hand-computed case', () => {
    const b = scoreOpportunity({ ...base, yoyPct: 25, recentSlopePct: 15, offerType: 'bundle', fatigueShare: 0.5, inventoryConstrained: true });
    expect(f(b, 'trendMomentum').score).toBe(50); // 100*(0.6*0.5+0.4*0.5)
    expect(f(b, 'effortRisk').score).toBe(round1(100 - (22.5 + 15 + 20)));
  });
  it('is monotonic: more yoy never lowers total, more fatigue never raises it', () => {
    let prev = -1;
    for (let y = -20; y <= 80; y += 5) { const t = scoreOpportunity({ ...base, yoyPct: y }).total; expect(t).toBeGreaterThanOrEqual(prev); prev = t; }
    prev = Infinity;
    for (let s = 0; s <= 1; s += 0.1) { const t = scoreOpportunity({ ...base, fatigueShare: s }).total; expect(t).toBeLessThanOrEqual(prev); prev = t; }
  });
  it('applies the effort table and inventory penalty', () => {
    expect(EFFORT).toEqual({ content_story: 15, early_access: 30, promo_discount: 40, bundle: 45, new_trip_launch: 55 });
    for (const [offer, e] of Object.entries(EFFORT)) {
      const b = scoreOpportunity({ ...base, offerType: offer as ScoringInput['offerType'], fatigueShare: 0 });
      expect(f(b, 'effortRisk').score).toBe(round1(100 - 0.5 * e));
    }
    const a = f(scoreOpportunity(base), 'effortRisk').score;
    const c = f(scoreOpportunity({ ...base, inventoryConstrained: true }), 'effortRisk').score;
    expect(a - c).toBeCloseTo(20, 5);
  });
  it('clamp01 and round1 behave', () => {
    expect(clamp01(-1)).toBe(0); expect(clamp01(2)).toBe(1); expect(round1(1.26)).toBe(1.3);
  });
});
