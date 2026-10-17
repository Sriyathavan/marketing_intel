import { describe, it, expect } from 'vitest';
import { buildOpportunities } from '../lib/opportunities';
import { loadCustomers } from '../lib/data';
import { buildSegmentProfiles, hasAffinity, isEligible, segmentOf } from '../lib/segments';

describe('buildOpportunities', () => {
  const opps = buildOpportunities();
  it('is deterministic', () => { expect(buildOpportunities()).toEqual(opps); });
  it('returns 5 ranked opportunities, max 2 per segment and interest', () => {
    expect(opps).toHaveLength(5);
    expect(opps.map((o) => o.rank)).toEqual([1, 2, 3, 4, 5]);
    const count = (key: 'segmentId' | 'interest') => {
      const m: Record<string, number> = {};
      for (const o of opps) m[o[key]] = (m[o[key]] ?? 0) + 1;
      return Math.max(...Object.values(m));
    };
    expect(count('segmentId')).toBeLessThanOrEqual(2);
    expect(count('interest')).toBeLessThanOrEqual(2);
    for (let i = 1; i < opps.length; i++) expect(opps[i - 1].score.total).toBeGreaterThanOrEqual(opps[i].score.total);
    expect(new Set(opps.map((o) => o.id)).size).toBe(5);
  });
  it('ids, window and evidence are well formed', () => {
    for (const o of opps) {
      expect(o.id).toBe(`opp_${o.interest}__${o.segmentId}`);
      expect(o.windowStart).toBe('2026-11-02'); expect(o.windowEnd).toBe('2027-01-30');
      expect(o.evidence.length).toBeGreaterThanOrEqual(5); expect(o.evidence.length).toBeLessThanOrEqual(8);
      const ids = o.evidence.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^ev_(trend|segment|seasonality|calendar|engagement)_/);
      expect(o.score.factors).toHaveLength(5);
      expect(o.reachable).toBeGreaterThan(0);
    }
  });
  it('reachable counts exclude opted-out and sensitive customers', () => {
    const customers = loadCustomers();
    const profiles = buildSegmentProfiles(customers);
    for (const o of opps) {
      const expected = customers.filter((c) => segmentOf(c) === o.segmentId && isEligible(c) && hasAffinity(c, o.interest)).length;
      expect(o.reachable).toBe(expected);
      const p = profiles.find((x) => x.id === o.segmentId)!;
      expect(o.reachable).toBeLessThanOrEqual(p.eligible);
    }
  });
  it('offer type follows the segment mapping', () => {
    const map: Record<string, string[]> = { seg_lapsed: ['promo_discount'], seg_new: ['content_story'], seg_premium: ['early_access'], seg_family: ['bundle'], seg_deal: ['promo_discount'], seg_mindful: ['new_trip_launch', 'content_story'] };
    for (const o of opps) expect(map[o.segmentId]).toContain(o.offerType);
  });
});
