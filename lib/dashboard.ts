import type { Customer, Interest, SegmentId, TrendsFile } from './types';
import { INTERESTS } from './types';
import { SEGMENT_IDS, SEGMENT_DEFS, buildSegmentProfiles, hasAffinity, isEligible, isSuppressed, segmentOf } from './segments';

export const INTEREST_LABELS: Record<Interest, string> = {
  hiking: 'Hiking', camping: 'Camping', snow_sports: 'Snow sports', water_sports: 'Water sports',
  cycling: 'Cycling', wildlife_safari: 'Wildlife safari', family_adventure: 'Family adventure', eco_lodges: 'Eco lodges',
};

export const ENGAGEMENT_STATES = ['active', 'reactivated', 'cooling', 'dormant'] as const;
export type EngagementState = typeof ENGAGEMENT_STATES[number];

export interface TrendRanking { id: string; term: string; interest: Interest; yoyPct: number; latest: number }
export interface RisingQuery { query: string; keyword: string; growth: number | 'breakout' }
export interface SegmentRow {
  id: SegmentId; name: string; size: number; eligible: number; clickRatePct: number;
  affinity: number[]; // share (0-1) of eligible members per INTERESTS entry
  engagement: Record<EngagementState, number>; // share (0-1) of eligible members
}
export interface DashboardData {
  trends: {
    source: string; capturedAt: string;
    top: TrendRanking[];
    months: string[];
    chart: Record<string, number | string>[]; // { month, [keywordId]: value }
    ranking: TrendRanking[];
    risingQueries: RisingQuery[];
  };
  customers: {
    total: number; eligible: number; optedOut: number; suppressed: number;
    interests: Interest[];
    segments: SegmentRow[];
  };
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;
const share = (n: number, d: number) => (d ? r3(n / d) : 0);

export function buildTrendSummary(trends: TrendsFile, topN = 5, queryN = 8): DashboardData['trends'] {
  const ranking: TrendRanking[] = trends.keywords
    .map(k => ({ id: k.id, term: k.term, interest: k.interest, yoyPct: k.yoyPct, latest: k.series[k.series.length - 1]?.value ?? 0 }))
    .sort((a, b) => b.yoyPct - a.yoyPct || a.term.localeCompare(b.term));
  const top = ranking.slice(0, topN);
  const byId = new Map(trends.keywords.map(k => [k.id, k]));
  const months = (byId.get(top[0]?.id)?.series ?? []).map(p => p.month);
  const chart = months.map((month, i) => {
    const row: Record<string, number | string> = { month };
    for (const t of top) row[t.id] = byId.get(t.id)!.series[i]?.value ?? 0;
    return row;
  });
  const seen = new Set<string>();
  const risingQueries: RisingQuery[] = trends.keywords
    .flatMap(k => k.risingQueries.map(q => ({ query: q.query, keyword: k.term, growth: q.growth })))
    .sort((a, b) => {
      const ga = a.growth === 'breakout' ? Infinity : a.growth;
      const gb = b.growth === 'breakout' ? Infinity : b.growth;
      return gb - ga || a.query.localeCompare(b.query);
    })
    .filter(q => (seen.has(q.query) ? false : (seen.add(q.query), true)))
    .slice(0, queryN);
  return { source: trends.source, capturedAt: trends.capturedAt, top, months, chart, ranking, risingQueries };
}

export function buildCustomerSummary(customers: Customer[]): DashboardData['customers'] {
  const profiles = buildSegmentProfiles(customers);
  const segments: SegmentRow[] = SEGMENT_IDS.map(id => {
    const p = profiles.find(x => x.id === id)!;
    const elig = customers.filter(c => segmentOf(c) === id && isEligible(c));
    const engagement = Object.fromEntries(ENGAGEMENT_STATES.map(s =>
      [s, share(elig.filter(c => c.email.engagementTrend === s).length, elig.length)])) as Record<EngagementState, number>;
    return {
      id, name: SEGMENT_DEFS[id].name, size: p.size, eligible: p.eligible,
      clickRatePct: Math.round(p.meanClickRate * 1000) / 10,
      affinity: INTERESTS.map(i => share(elig.filter(c => hasAffinity(c, i)).length, elig.length)),
      engagement,
    };
  });
  return {
    total: customers.length,
    eligible: customers.filter(isEligible).length,
    optedOut: customers.filter(c => !c.consent.emailOptIn).length,
    suppressed: customers.filter(c => c.consent.emailOptIn && isSuppressed(c)).length,
    interests: [...INTERESTS],
    segments,
  };
}

export function buildDashboard(trends: TrendsFile, customers: Customer[]): DashboardData {
  return { trends: buildTrendSummary(trends), customers: buildCustomerSummary(customers) };
}
