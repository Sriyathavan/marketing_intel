import { describe, it, expect } from 'vitest';
import { loadContext, loadCustomers, loadTrends } from '../lib/data';
import { INTERESTS, SENSITIVE_EVENTS } from '../lib/types';
import { buildSegmentProfiles } from '../lib/segments';

describe('data files', () => {
  const customers = loadCustomers();
  it('has 200 unique customers with valid enums', () => {
    expect(customers).toHaveLength(200);
    expect(new Set(customers.map((c) => c.id)).size).toBe(200);
    for (const c of customers) {
      expect(c.id).toMatch(/^c_\d{4}$/);
      expect(c.declared.interests.length).toBeGreaterThan(0);
      for (const i of [...c.declared.interests, ...c.site.browsedInterests, ...Object.keys(c.email.clickByTopic)]) expect(INTERESTS).toContain(i);
      expect(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']).toContain(c.email.bestSendDay);
      expect([1, 2, 3]).toContain(c.email.fatigueThresholdPerWeek);
      expect(c.transactional.peakBookingMonth).toBeGreaterThanOrEqual(1);
      expect(c.transactional.peakBookingMonth).toBeLessThanOrEqual(12);
    }
  });
  it('segments land in 20-50 each', () => {
    const p = buildSegmentProfiles(customers);
    expect(p).toHaveLength(6);
    for (const s of p) { expect(s.size).toBeGreaterThanOrEqual(20); expect(s.size).toBeLessThanOrEqual(50); }
    expect(p.reduce((s, x) => s + x.size, 0)).toBe(200);
  });
  it('sensitive share is 5-12% and opt-outs about 6%', () => {
    const sens = customers.filter((c) => c.lifeEvents.some((e) => SENSITIVE_EVENTS.includes(e.type))).length / 200;
    expect(sens).toBeGreaterThanOrEqual(0.05); expect(sens).toBeLessThanOrEqual(0.12);
    const out = customers.filter((c) => !c.consent.emailOptIn).length / 200;
    expect(out).toBeCloseTo(0.06, 2);
  });
  it('trends: 12 keywords, 24 points ending 2026-09, yoyPct matches series', () => {
    const t = loadTrends();
    expect(t.keywords).toHaveLength(12);
    for (const k of t.keywords) {
      expect(k.series).toHaveLength(24);
      expect(k.series[23].month).toBe('2026-09');
      expect(k.seasonalityIndex).toHaveLength(12);
      expect(k.seasonalityIndex.reduce((s, x) => s + x, 0) / 12).toBeCloseTo(1, 2);
      const v = k.series.map((p) => p.value);
      const m = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
      expect(k.yoyPct).toBe(Math.round((m(v.slice(12)) / m(v.slice(0, 12)) - 1) * 100));
      expect(k.yoyPct).toBeGreaterThanOrEqual(-5); expect(k.yoyPct).toBeLessThanOrEqual(60);
    }
    const rising = t.keywords.filter((k) => k.yoyPct >= 25).length;
    expect(rising).toBeGreaterThanOrEqual(5); expect(rising).toBeLessThanOrEqual(6);
  });
  it('context: planEnd = planStart + 89 days, blackouts, constrained launch', () => {
    const c = loadContext();
    const end = new Date(Date.parse(c.planStart) + 89 * 86400000).toISOString().slice(0, 10);
    expect(c.planEnd).toBe(end);
    expect(c.sendBlackouts).toEqual(['2026-11-26', '2026-12-24', '2026-12-25', '2026-12-26']);
    expect(c.launches.length).toBeGreaterThanOrEqual(4);
    expect(c.launches.some((l) => l.inventoryConstrained)).toBe(true);
  });
});
