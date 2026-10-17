import { describe, it, expect } from 'vitest';
import { getPlan } from '@/lib/getPlan';
import { buildOpportunities } from '@/lib/opportunities';

describe('getPlan', () => {
  it('returns the cached plan covering every opportunity', async () => {
    const plan = await getPlan();
    expect(plan.planStart).toBe('2026-11-02');
    const ids = new Set(plan.sequences.map((s) => s.opportunityId));
    for (const o of buildOpportunities()) expect(ids.has(o.id)).toBe(true);
    for (const s of plan.sequences) expect(s.emails.length).toBeGreaterThanOrEqual(4);
  });
});
