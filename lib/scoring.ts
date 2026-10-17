import type { FactorKey, OfferType, ScoreBreakdown, ScoreFactor, ScoringInput } from './types';

export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
export const round1 = (x: number): number => Math.round(x * 10) / 10;

export const WEIGHTS: Record<FactorKey, number> = {
  trendMomentum: 0.25,
  segmentFit: 0.25,
  seasonalTiming: 0.2,
  revenuePotential: 0.2,
  effortRisk: 0.1,
};

export const EFFORT: Record<OfferType, number> = {
  content_story: 15,
  early_access: 30,
  promo_discount: 40,
  bundle: 45,
  new_trip_launch: 55,
};

const LABELS: Record<FactorKey, string> = {
  trendMomentum: 'Trend momentum',
  segmentFit: 'Segment fit',
  seasonalTiming: 'Seasonal timing',
  revenuePotential: 'Revenue potential',
  effortRisk: 'Effort and risk',
};

const pct = (x: number) => `${round1(x * 100)}%`;

export function scoreOpportunity(input: ScoringInput): ScoreBreakdown {
  const effort = EFFORT[input.offerType];
  const raw: Record<FactorKey, number> = {
    trendMomentum: 100 * (0.6 * clamp01(input.yoyPct / 50) + 0.4 * clamp01(input.recentSlopePct / 30)),
    segmentFit: 100 * (0.6 * input.affinityShare + 0.4 * clamp01(input.meanClickRate / 0.1)),
    seasonalTiming: 100 * (0.6 * clamp01((input.avgSeasonIdx - 0.7) / 0.8) + 0.4 * input.bookingWindowShare),
    revenuePotential: 100 * clamp01((input.reachable * input.meanAov) / 120000),
    effortRisk:
      100 - Math.min(100, Math.max(0, 0.5 * effort + 0.3 * (100 * input.fatigueShare) + 0.2 * (input.inventoryConstrained ? 100 : 0))),
  };
  const inputs: Record<FactorKey, Record<string, number>> = {
    trendMomentum: { yoyPct: input.yoyPct, recentSlopePct: input.recentSlopePct },
    segmentFit: { affinityShare: input.affinityShare, meanClickRate: input.meanClickRate },
    seasonalTiming: { avgSeasonIdx: input.avgSeasonIdx, bookingWindowShare: input.bookingWindowShare },
    revenuePotential: { reachable: input.reachable, meanAov: input.meanAov, potentialUsd: input.reachable * input.meanAov },
    effortRisk: { effort, fatigueShare: input.fatigueShare, inventoryConstrained: input.inventoryConstrained ? 1 : 0 },
  };
  const explanations: Record<FactorKey, string> = {
    trendMomentum: `Search interest is ${round1(input.yoyPct)}% year over year and ${round1(input.recentSlopePct)}% up over the last 3 months.`,
    segmentFit: `${pct(input.affinityShare)} of eligible members show affinity, with a ${pct(input.meanClickRate)} mean click rate.`,
    seasonalTiming: `Average seasonality index over the plan window is ${round1(input.avgSeasonIdx * 100) / 100}, and ${pct(input.bookingWindowShare)} of members usually book in Nov to Jan.`,
    revenuePotential: `${input.reachable} reachable members at $${Math.round(input.meanAov)} mean order value gives $${Math.round(input.reachable * input.meanAov).toLocaleString('en-US')} of order potential.`,
    effortRisk: `${input.offerType.replace(/_/g, ' ')} carries effort ${effort}/100; ${pct(input.fatigueShare)} of the segment is fatigue-sensitive${input.inventoryConstrained ? ' and inventory is constrained' : ''}.`,
  };
  const keys = Object.keys(WEIGHTS) as FactorKey[];
  const factors: ScoreFactor[] = keys.map((key) => ({
    key,
    label: LABELS[key],
    weight: WEIGHTS[key],
    score: round1(raw[key]),
    contribution: round1(WEIGHTS[key] * raw[key]),
    inputs: inputs[key],
    explanation: explanations[key],
  }));
  const total = round1(keys.reduce((s, k) => s + WEIGHTS[k] * raw[k], 0));
  return { total, factors };
}
