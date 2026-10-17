import { INTERESTS } from './types';
import type { ContextFile, Evidence, Interest, Opportunity, SegmentId, SegmentProfile, TrendKeyword } from './types';
import { loadContext, loadCustomers, loadTrends } from './data';
import { scoreOpportunity } from './scoring';
import {
  buildScoringInput, buildSegmentProfiles, dateToUtcMs, offerTypeFor, segmentOf,
  SEGMENT_IDS,
} from './segments';

const INTEREST_LABEL: Record<Interest, string> = {
  hiking: 'Hiking', camping: 'Camping', snow_sports: 'Snow sports', water_sports: 'Water sports', cycling: 'Cycling',
  wildlife_safari: 'Wildlife safari', family_adventure: 'Family adventure', eco_lodges: 'Eco lodges',
};
const r1 = (x: number) => Math.round(x * 10) / 10;

function nearestCalendar(interest: Interest, ctx: ContextFile): { id: string; name: string; date: string; kind: 'launch' | 'holiday'; days: number } {
  const start = dateToUtcMs(ctx.planStart);
  const launch = ctx.launches.filter((l) => l.interest === interest).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (launch) return { id: launch.id, name: launch.name, date: launch.date, kind: 'launch', days: Math.round((dateToUtcMs(launch.date) - start) / 86400000) };
  const h = [...ctx.holidays].sort((a, b) => Math.abs(dateToUtcMs(a.date) - start) - Math.abs(dateToUtcMs(b.date) - start) || a.id.localeCompare(b.id));
  const pick = ctx.holidays.length ? h[0] : null;
  if (!pick) throw new Error('no holidays in context');
  return { id: pick.id, name: pick.name, date: pick.date, kind: 'holiday', days: Math.round((dateToUtcMs(pick.date) - start) / 86400000) };
}

function makeEvidence(
  interest: Interest, profile: SegmentProfile, keywords: TrendKeyword[], ctx: ContextFile, affinityShare: number,
  seasonIdx: number, slope: number, yoy: number,
): Evidence[] {
  const seg = profile.id;
  const lead = [...keywords].sort((a, b) => b.yoyPct - a.yoyPct || a.id.localeCompare(b.id))[0];
  const rq = keywords.flatMap((k) => k.risingQueries.map((q) => ({ k, q })))
    .sort((a, b) => {
      const ga = a.q.growth === 'breakout' ? Infinity : a.q.growth;
      const gb = b.q.growth === 'breakout' ? Infinity : b.q.growth;
      return gb - ga || a.q.query.localeCompare(b.q.query);
    })[0];
  const cal = nearestCalendar(interest, ctx);
  const ev: Evidence[] = [
    { id: `ev_trend_${lead.id}_yoy`, kind: 'trend', label: `Search interest year over year (${keywords.map((k) => k.term).join(', ')})`, value: r1(yoy), unit: '%', source: { file: 'trends.json', ref: lead.id } },
  ];
  if (rq) ev.push({ id: `ev_trend_${rq.k.id}_rising`, kind: 'trend', label: `Top rising query: "${rq.q.query}"`, value: rq.q.growth === 'breakout' ? 'breakout' : rq.q.growth, unit: rq.q.growth === 'breakout' ? undefined : '%', source: { file: 'trends.json', ref: rq.k.id } });
  ev.push(
    { id: `ev_segment_${seg}_${interest}_affinity`, kind: 'segment', label: `${profile.name} with ${INTEREST_LABEL[interest].toLowerCase()} affinity`, value: r1(affinityShare * 100), unit: '%', source: { file: 'customers.json', ref: `${seg}.${interest}` } },
    { id: `ev_segment_${seg}_eligible`, kind: 'segment', label: `Eligible ${profile.name} members`, value: profile.eligible, source: { file: 'customers.json', ref: seg } },
    { id: `ev_engagement_${seg}_clickrate`, kind: 'engagement', label: `${profile.name} mean click rate (30d)`, value: r1(profile.meanClickRate * 100), unit: '%', source: { file: 'customers.json', ref: seg } },
    { id: `ev_seasonality_${interest}_idx`, kind: 'seasonality', label: `Average seasonality index across the plan window`, value: Math.round(seasonIdx * 100) / 100, source: { file: 'trends.json', ref: lead.id } },
    { id: `ev_calendar_${cal.id}_${cal.kind}`, kind: 'calendar', label: `${cal.kind === 'launch' ? 'Launch' : 'Nearest holiday'}: ${cal.name} (${cal.date})`, value: cal.days, unit: 'days from plan start', source: { file: 'context.json', ref: cal.id } },
  );
  if (profile.suppressedSensitive > 0) {
    ev.push({ id: `ev_segment_${seg}_suppressed`, kind: 'segment', label: `${profile.name} members suppressed for sensitive life events`, value: profile.suppressedSensitive, source: { file: 'customers.json', ref: seg } });
  }
  ev.push({ id: `ev_trend_${lead.id}_slope`, kind: 'trend', label: 'Three-month search trend slope', value: r1(slope), unit: '%', source: { file: 'trends.json', ref: lead.id } });
  return ev.slice(0, 8);
}

interface Candidate { opp: Opportunity }

/** Every scored segment x interest candidate, ranked by score (the evidence layer). */
export function buildAllOpportunities(): Opportunity[] {
  const customers = loadCustomers();
  const ctx = loadContext();
  const trends = loadTrends();
  const profiles = buildSegmentProfiles(customers);
  const cands: Candidate[] = [];

  for (const interest of INTERESTS) {
    const keywords = trends.keywords.filter((k) => k.interest === interest);
    if (!keywords.length) continue;
    for (const segId of SEGMENT_IDS) {
      const profile = profiles.find((p) => p.id === segId)!;
      if (profile.eligible === 0) continue;
      const members = customers.filter((c) => segmentOf(c) === segId);
      const offerType = offerTypeFor(segId, interest, ctx);
      const input = buildScoringInput(interest, profile, members, keywords, ctx, offerType);
      if (input.reachable === 0) continue;
      const score = scoreOpportunity(input);
      const label = INTEREST_LABEL[interest];
      cands.push({
        opp: {
          id: `opp_${interest}__${segId}`, rank: 0,
          title: `${label} for ${profile.name}`,
          thesis: `${label} search interest is up ${r1(input.yoyPct)}% year over year and ${Math.round(input.affinityShare * 100)}% of eligible ${profile.name} members show affinity; a ${offerType.replace(/_/g, ' ')} approach fits this segment across the plan window.`,
          interest, trendIds: keywords.map((k) => k.id), segmentId: segId, offerType,
          windowStart: ctx.planStart, windowEnd: ctx.planEnd,
          reachable: input.reachable,
          evidence: makeEvidence(interest, profile, keywords, ctx, input.affinityShare, input.avgSeasonIdx, input.recentSlopePct, input.yoyPct),
          score,
        },
      });
    }
  }

  const tm = (o: Opportunity) => o.score.factors.find((f) => f.key === 'trendMomentum')!.score;
  cands.sort((a, b) => b.opp.score.total - a.opp.score.total || tm(b.opp) - tm(a.opp) || a.opp.id.localeCompare(b.opp.id));

  return cands.map((c) => c.opp);
}

export function buildOpportunities(): Opportunity[] {
  const picked: Opportunity[] = [];
  const bySeg: Partial<Record<SegmentId, number>> = {};
  const byInt: Partial<Record<Interest, number>> = {};
  for (const opp of buildAllOpportunities()) {
    if (picked.length === 5) break;
    if ((bySeg[opp.segmentId] ?? 0) >= 2 || (byInt[opp.interest] ?? 0) >= 2) continue;
    bySeg[opp.segmentId] = (bySeg[opp.segmentId] ?? 0) + 1;
    byInt[opp.interest] = (byInt[opp.interest] ?? 0) + 1;
    picked.push({ ...opp, rank: picked.length + 1 });
  }
  return picked;
}

