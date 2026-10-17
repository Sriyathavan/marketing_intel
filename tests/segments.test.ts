import { describe, it, expect } from 'vitest';
import { loadCustomers } from '../lib/data';
import { buildSegmentProfiles, isEligible, isSuppressed, segmentOf } from '../lib/segments';
import type { Customer } from '../lib/types';

const customers = loadCustomers();
const clone = (c: Customer): Customer => JSON.parse(JSON.stringify(c));

describe('segments', () => {
  it('first match wins: lapsed before everything', () => {
    const c = clone(customers[0]);
    c.email.engagementTrend = 'dormant'; c.loyalty.tier = 'platinum'; c.loyalty.lifecycleStage = 'first_time_buyer';
    expect(segmentOf(c)).toBe('seg_lapsed');
    c.email.engagementTrend = 'active'; c.transactional.recencyDays = 271;
    expect(segmentOf(c)).toBe('seg_lapsed');
  });
  it('rule order new > premium > family > deal > mindful', () => {
    const c = clone(customers[0]);
    c.email.engagementTrend = 'active'; c.transactional.recencyDays = 30; c.loyalty.lifecycleStage = 'repeat';
    c.loyalty.tier = 'none'; c.transactional.ltv = 1000; c.demographic.household.composition = 'single';
    c.transactional.discountUsageRate = 0.1; c.psychographic.buyingStyle = 'researcher';
    expect(segmentOf(c)).toBe('seg_mindful');
    c.transactional.discountUsageRate = 0.5; expect(segmentOf(c)).toBe('seg_deal');
    c.demographic.household.composition = 'couple_kids'; expect(segmentOf(c)).toBe('seg_family');
    c.transactional.ltv = 4000; expect(segmentOf(c)).toBe('seg_premium');
    c.loyalty.lifecycleStage = 'first_time_buyer'; expect(segmentOf(c)).toBe('seg_new');
  });
  it('suppression and eligibility', () => {
    const c = clone(customers[0]);
    c.consent.emailOptIn = true; c.lifeEvents = [{ type: 'bereavement', date: '2026-01-01' }];
    expect(isSuppressed(c)).toBe(true); expect(isEligible(c)).toBe(false);
    c.lifeEvents = [{ type: 'wedding', date: '2026-01-01' }];
    expect(isEligible(c)).toBe(true);
    c.consent.emailOptIn = false; expect(isEligible(c)).toBe(false);
  });
  it('profiles exclude sensitive and opted-out from eligible', () => {
    const profiles = buildSegmentProfiles(customers);
    for (const p of profiles) {
      const members = customers.filter((c) => segmentOf(c) === p.id);
      expect(p.size).toBe(members.length);
      expect(p.eligible).toBe(members.filter(isEligible).length);
      expect(p.optedOut).toBe(members.filter((c) => !c.consent.emailOptIn).length);
      expect(p.eligible + p.optedOut + p.suppressedSensitive).toBe(p.size);
      expect([1, 2, 3]).toContain(p.fatigueCapPerWeek);
    }
    expect(profiles.reduce((s, p) => s + p.suppressedSensitive, 0)).toBeGreaterThan(0);
  });
  it('send-time clustering per segment', () => {
    const p = Object.fromEntries(buildSegmentProfiles(customers).map((x) => [x.id, x]));
    expect([p.seg_family.modalSendDay, p.seg_family.modalSendHour]).toEqual(['Sun', 19]);
    expect([p.seg_premium.modalSendDay, p.seg_premium.modalSendHour]).toEqual(['Tue', 7]);
    expect([p.seg_deal.modalSendDay, p.seg_deal.modalSendHour]).toEqual(['Thu', 12]);
  });
});
