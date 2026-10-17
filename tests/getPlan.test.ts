import { describe, it, expect } from 'vitest';
import { getPlan } from '@/lib/getPlan';

describe('getPlan', () => {
  it('returns the cached plan with brief ids, assumptions and derived schedule', async () => {
    const plan = await getPlan();
    expect(plan.planStart).toBe('2026-11-02');
    expect(plan.assumptions.length).toBeGreaterThan(0);
    for (const s of plan.sequences) {
      expect(s.emails.length).toBeGreaterThanOrEqual(4);
      expect(s.audienceIds.length).toBeGreaterThan(0);
      expect(s.productLineIds.length).toBeGreaterThan(0);
      expect(s.startDate).toBe(s.emails[0].sendDate);
      expect(s.endDate).toBe(s.emails[s.emails.length - 1].sendDate);
    }
  });
});
