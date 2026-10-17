import { SENSITIVE_EVENTS } from './types';
import type { Customer, Interest, OfferType, ScoringInput, SegmentId, SegmentProfile, TrendKeyword, ContextFile } from './types';
import { INTERESTS } from './types';

export const SEGMENT_IDS: SegmentId[] = ['seg_lapsed', 'seg_new', 'seg_premium', 'seg_family', 'seg_deal', 'seg_mindful'];

export const SEGMENT_DEFS: Record<SegmentId, { name: string; definition: string }> = {
  seg_lapsed: { name: 'Lapsed Wanderers', definition: 'Dormant engagement or no purchase in over 270 days' },
  seg_new: { name: 'New Explorers', definition: 'Subscribers who have not yet booked, or first-time buyers' },
  seg_premium: { name: 'Premium Adventurers', definition: 'Lifetime value of $4,000 or more, or gold/platinum tier' },
  seg_family: { name: 'Family Getaways', definition: 'Households with kids or multiple generations' },
  seg_deal: { name: 'Deal Seekers', definition: 'Uses discounts on half of orders or more, or a deal-hunter buying style' },
  seg_mindful: { name: 'Mindful Explorers', definition: 'Everyone else: steady, value-driven travelers' },
};

export function segmentOf(c: Customer): SegmentId {
  const { loyalty, transactional: t, email, demographic, psychographic } = c;
  if (email.engagementTrend === 'dormant' || t.recencyDays > 270) return 'seg_lapsed';
  if (loyalty.lifecycleStage === 'subscriber_only' || loyalty.lifecycleStage === 'first_time_buyer') return 'seg_new';
  if (t.ltv >= 4000 || loyalty.tier === 'gold' || loyalty.tier === 'platinum') return 'seg_premium';
  const comp = demographic.household.composition;
  if (comp === 'couple_kids' || comp === 'single_parent' || comp === 'multigenerational') return 'seg_family';
  if (t.discountUsageRate >= 0.5 || psychographic.buyingStyle === 'deal_hunter') return 'seg_deal';
  return 'seg_mindful';
}

export function isSuppressed(c: Customer): boolean {
  return c.lifeEvents.some((e) => SENSITIVE_EVENTS.includes(e.type));
}

export function isEligible(c: Customer): boolean {
  return c.consent.emailOptIn && !isSuppressed(c);
}

export function hasAffinity(c: Customer, interest: Interest): boolean {
  return (
    c.declared.interests.includes(interest) ||
    (c.email.clickByTopic[interest] ?? 0) > 0 ||
    c.site.browsedInterests.includes(interest)
  );
}

const mean = (xs: number[]): number => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const r3 = (x: number): number => Math.round(x * 1000) / 1000;

function mode<T>(xs: T[], fallback: T): T {
  const counts = new Map<T, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  let best = fallback;
  let bestN = 0;
  for (const [k, n] of counts) {
    if (n > bestN) { best = k; bestN = n; }
  }
  return best;
}

export function buildSegmentProfiles(customers: Customer[]): SegmentProfile[] {
  return SEGMENT_IDS.map((id) => {
    const members = customers.filter((c) => segmentOf(c) === id);
    const elig = members.filter(isEligible);
    const thresholds = elig.map((c) => c.email.fatigueThresholdPerWeek).sort((a, b) => a - b);
    const cap = (thresholds.length ? thresholds[Math.floor((thresholds.length - 1) / 2)] : 1) as 1 | 2 | 3;
    const topInterests = INTERESTS.map((interest) => ({
      interest,
      share: r3(elig.length ? elig.filter((c) => hasAffinity(c, interest)).length / elig.length : 0),
    }))
      .sort((a, b) => b.share - a.share || a.interest.localeCompare(b.interest))
      .slice(0, 3);
    return {
      id,
      name: SEGMENT_DEFS[id].name,
      definition: SEGMENT_DEFS[id].definition,
      size: members.length,
      eligible: elig.length,
      suppressedSensitive: members.filter((c) => c.consent.emailOptIn && isSuppressed(c)).length,
      optedOut: members.filter((c) => !c.consent.emailOptIn).length,
      meanClickRate: r3(mean(elig.map((c) => c.email.clickRate30d))),
      meanAov: Math.round(mean(elig.map((c) => c.transactional.aov))),
      meanLtv: Math.round(mean(elig.map((c) => c.transactional.ltv))),
      fatigueShare: r3(elig.length ? elig.filter((c) => c.email.fatigueThresholdPerWeek === 1).length / elig.length : 0),
      fatigueCapPerWeek: cap,
      modalSendDay: mode(elig.map((c) => c.email.bestSendDay), 'Tue'),
      modalSendHour: mode(elig.map((c) => c.email.bestSendHour), 9),
      topInterests,
      dominantTone: mode(elig.map((c) => c.psychographic.toneAffinity), 'educational'),
    };
  });
}

// ---------- scoring-input builders ----------

export function dateToUtcMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Mean over keywords of seasonalityIndex averaged over every plan day (by month). */
export function avgSeasonIdx(keywords: TrendKeyword[], planStart: string, planEnd: string): number {
  const dayCounts = new Array(12).fill(0);
  for (let t = dateToUtcMs(planStart); t <= dateToUtcMs(planEnd); t += 86400000) dayCounts[new Date(t).getUTCMonth()]++;
  const total = dayCounts.reduce((s: number, n: number) => s + n, 0);
  return mean(keywords.map((k) => k.seasonalityIndex.reduce((s, v, m) => s + v * dayCounts[m], 0) / total));
}

export function recentSlopePct(k: TrendKeyword): number {
  const v = k.series.map((p) => p.value);
  const last3 = mean(v.slice(-3));
  const prior3 = mean(v.slice(-6, -3));
  return prior3 ? (last3 / prior3 - 1) * 100 : 0;
}

export function offerTypeFor(segmentId: SegmentId, interest: Interest, ctx: ContextFile): OfferType {
  switch (segmentId) {
    case 'seg_lapsed': return 'promo_discount';
    case 'seg_new': return 'content_story';
    case 'seg_premium': return 'early_access';
    case 'seg_family': return 'bundle';
    case 'seg_deal': return 'promo_discount';
    default: return ctx.launches.some((l) => l.interest === interest) ? 'new_trip_launch' : 'content_story';
  }
}

export interface CandidateStats {
  input: ScoringInput;
  eligible: number;
}

export function buildScoringInput(
  interest: Interest,
  profile: SegmentProfile,
  members: Customer[],
  keywords: TrendKeyword[],
  ctx: ContextFile,
  offerType: OfferType,
): ScoringInput {
  const elig = members.filter(isEligible);
  const aff = elig.filter((c) => hasAffinity(c, interest));
  return {
    yoyPct: mean(keywords.map((k) => k.yoyPct)),
    recentSlopePct: mean(keywords.map(recentSlopePct)),
    affinityShare: elig.length ? aff.length / elig.length : 0,
    meanClickRate: profile.meanClickRate,
    avgSeasonIdx: avgSeasonIdx(keywords, ctx.planStart, ctx.planEnd),
    bookingWindowShare: elig.length ? elig.filter((c) => [11, 12, 1].includes(c.transactional.peakBookingMonth)).length / elig.length : 0,
    reachable: aff.length,
    meanAov: profile.meanAov,
    offerType,
    fatigueShare: profile.fatigueShare,
    inventoryConstrained: ctx.launches.some((l) => l.interest === interest && l.inventoryConstrained),
  };
}
