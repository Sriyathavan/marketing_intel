import { INTERESTS } from '../types';
import type { Evidence, Opportunity, SegmentId, SegmentProfile, TrendsFile, Customer, ContextFile } from '../types';
import { loadContext, loadCustomers, loadTrends } from '../data';
import { buildAllOpportunities } from '../opportunities';
import { avgSeasonIdx, buildSegmentProfiles, hasAffinity, isEligible, recentSlopePct, segmentOf, SEGMENT_IDS } from '../segments';

const r1 = (x: number) => Math.round(x * 10) / 10;
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface Packets {
  context: ContextFile;
  trends: TrendsFile;
  profiles: SegmentProfile[];
  /** All scored segment x interest candidates (deterministic evidence layer). */
  candidates: Opportunity[];
  /** Compact JSON given to the analyst. */
  analystPayload: unknown;
}

/** Step 0 (no AI): turn the raw datasets into aggregate packets. */
export function buildPackets(): Packets {
  const context = loadContext();
  const trends = loadTrends();
  const customers = loadCustomers();
  const profiles = buildSegmentProfiles(customers);
  const candidates = buildAllOpportunities();

  const trendRows = trends.keywords.map((k) => {
    const v = k.series.map((p) => p.value);
    const peakIdx = k.seasonalityIndex.indexOf(Math.max(...k.seasonalityIndex));
    return {
      id: k.id, term: k.term, interest: k.interest,
      latest: v[v.length - 1], avgLast12m: r1(mean(v.slice(-12))), avgPrior12m: r1(mean(v.slice(-24, -12))),
      yoyPct: k.yoyPct, slope3mPct: r1(recentSlopePct(k)),
      peakMonth: MONTHS[peakIdx], planWindowSeasonalityIdx: Math.round(avgSeasonIdx([k], context.planStart, context.planEnd) * 100) / 100,
      risingQueries: k.risingQueries.slice(0, 3),
    };
  });

  const eligBySeg = new Map<SegmentId, Customer[]>(SEGMENT_IDS.map((id) => [id, customers.filter((c) => segmentOf(c) === id && isEligible(c))]));
  const segRows = profiles.map((p) => {
    const elig = eligBySeg.get(p.id)!;
    const trendMix: Record<string, number> = {};
    for (const c of elig) trendMix[c.email.engagementTrend] = (trendMix[c.email.engagementTrend] ?? 0) + 1;
    return {
      id: p.id, name: p.name, definition: p.definition, size: p.size, eligible: p.eligible, suppressedSensitive: p.suppressedSensitive,
      meanClickRatePct: r1(p.meanClickRate * 100), meanAov: p.meanAov, meanLtv: p.meanLtv,
      fatigueCapPerWeek: p.fatigueCapPerWeek, modalSendDay: p.modalSendDay, modalSendHour: p.modalSendHour, dominantTone: p.dominantTone,
      engagementTrendCounts: trendMix,
      interestAffinityPct: Object.fromEntries(INTERESTS.map((i) => [i, r1(elig.length ? (elig.filter((c) => hasAffinity(c, i)).length / elig.length) * 100 : 0)])),
    };
  });

  const catalog = new Map<string, Evidence>();
  for (const c of candidates) for (const e of c.evidence) catalog.set(e.id, e);

  const analystPayload = {
    trendsSnapshot: { capturedAt: trends.capturedAt, geo: trends.geo, note: trends.source },
    planWindow: { start: context.planStart, end: context.planEnd },
    trends: trendRows,
    segments: segRows,
    scoredCandidates: candidates.map((c) => ({
      id: c.id, interest: c.interest, segmentId: c.segmentId, scoreTotal: c.score.total,
      factorScores: Object.fromEntries(c.score.factors.map((f) => [f.key, Math.round(f.score)])),
      reachable: c.reachable, evidenceIds: c.evidence.map((e) => e.id),
    })),
    evidenceCatalog: [...catalog.values()].map((e) => ({ id: e.id, label: e.label, value: e.value, unit: e.unit })),
  };

  return { context, trends, profiles, candidates, analystPayload };
}

/** All evidence ids that exist in the deterministic evidence layer. */
export function evidenceIdSet(candidates: Opportunity[]): Set<string> {
  return new Set(candidates.flatMap((c) => c.evidence.map((e) => e.id)));
}
