import { describe, it, expect } from 'vitest';
import { buildDashboard, ENGAGEMENT_STATES } from '../lib/dashboard';
import { loadCustomers, loadTrends } from '../lib/data';

const d = buildDashboard(loadTrends(), loadCustomers());

describe('dashboard trends', () => {
  it('ranks all keywords by yoy descending', () => {
    const r = d.trends.ranking;
    expect(r).toHaveLength(loadTrends().keywords.length);
    for (let i = 1; i < r.length; i++) expect(r[i - 1].yoyPct).toBeGreaterThanOrEqual(r[i].yoyPct);
  });
  it('charts the top 5 with one point per month', () => {
    expect(d.trends.top).toHaveLength(5);
    expect(d.trends.chart).toHaveLength(24);
    for (const row of d.trends.chart) for (const t of d.trends.top) expect(typeof row[t.id]).toBe('number');
  });
  it('lists unique rising queries, breakouts first', () => {
    const q = d.trends.risingQueries;
    expect(new Set(q.map(x => x.query)).size).toBe(q.length);
    const firstNonBreakout = q.findIndex(x => x.growth !== 'breakout');
    if (firstNonBreakout >= 0) expect(q.slice(firstNonBreakout).every(x => x.growth !== 'breakout')).toBe(true);
  });
});

describe('dashboard customers', () => {
  it('segment sizes add up and exclude nobody silently', () => {
    const c = d.customers;
    expect(c.segments.reduce((s, x) => s + x.size, 0)).toBe(c.total);
    expect(c.total).toBe(200);
    expect(c.eligible + c.optedOut + c.suppressed).toBe(c.total);
  });
  it('engagement shares sum to ~1 and affinity shares are in range', () => {
    for (const s of d.customers.segments) {
      const sum = ENGAGEMENT_STATES.reduce((a, k) => a + s.engagement[k], 0);
      expect(Math.abs(sum - 1)).toBeLessThan(0.01);
      expect(s.affinity).toHaveLength(d.customers.interests.length);
      for (const a of s.affinity) { expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThanOrEqual(1); }
    }
  });
  it('click rate is expressed in percent', () => {
    for (const s of d.customers.segments) { expect(s.clickRatePct).toBeGreaterThan(0); expect(s.clickRatePct).toBeLessThan(100); }
  });
});
