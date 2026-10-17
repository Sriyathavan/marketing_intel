import type { CampaignPlan, ContextFile, Opportunity, SegmentProfile, SegmentId } from '@/lib/types';
import type { ModelPlan } from '@/lib/planSchema';

export const CTX: ContextFile = {
  planStart: '2026-11-02', planEnd: '2027-01-30', hemisphere: 'north', seasons: [],
  holidays: [{ id: 'h1', name: 'Black Friday', date: '2026-11-27', kind: 'shopping', demandBoost: 1.5 }],
  launches: [], paydays: '1st and 15th', sendBlackouts: ['2026-12-25', '2027-01-01'],
};

export function profile(id: SegmentId, over: Partial<SegmentProfile> = {}): SegmentProfile {
  return {
    id, name: id, definition: 'd', size: 40, eligible: 34, suppressedSensitive: 4, optedOut: 2,
    meanClickRate: 0.05, meanAov: 900, meanLtv: 2000, fatigueShare: 0.2, fatigueCapPerWeek: 2,
    modalSendDay: 'Tue', modalSendHour: 7, topInterests: [], dominantTone: 'playful', ...over,
  };
}

export function opp(n: number, segmentId: SegmentId = 'seg_family'): Opportunity {
  const id = `opp_o${n}__${segmentId}`;
  return {
    id, rank: n, title: `Opp ${n}`, thesis: 't', interest: 'hiking', trendIds: [], segmentId,
    offerType: 'bundle', windowStart: '2026-11-02', windowEnd: '2027-01-30', reachable: 20,
    evidence: [1, 2, 3].map((k) => ({ id: `ev_trend_o${n}_${k}`, kind: 'trend' as const, label: `Label ${k}`, value: k, source: { file: 'trends.json' as const, ref: 'x' } })),
    score: { total: 70, factors: [{ key: 'trendMomentum', label: 'Trend momentum', weight: 0.25, score: 80, contribution: 20, inputs: {}, explanation: 'e' }] },
  };
}

export function modelEmail(o: ReturnType<typeof opp>, step: number, date: string, over: Record<string, unknown> = {}) {
  return {
    step, sendDate: date, sendTimeLocal: '07:00', subject: `Subject ${step}`, preheader: 'Pre', creativeDirection: 'Hero shot',
    cta: { label: 'Go', target: '/trips' }, offerType: 'bundle' as const, rationale: 'Because', evidenceIds: [o.evidence[0].id], ...over,
  };
}

export function modelPlanFor(opps: Opportunity[], dates = ['2026-11-03', '2026-11-12', '2026-11-24', '2026-12-08']): ModelPlan {
  return {
    sequences: opps.map((o) => ({
      opportunityId: o.id, name: `Seq ${o.id}`, goal: 'g', cadence: { emailsPerWeek: 1, spacingDays: 10 },
      rationale: 'r', evidenceIds: [o.evidence[0].id],
      emails: dates.map((d, i) => modelEmail(o, i + 1, d)),
    })),
  };
}

export function cachedPlanFor(opps: Opportunity[]): CampaignPlan {
  const seqs = opps.map((o) => ({
    id: `seq_${o.id}`, opportunityId: o.id, segmentId: o.segmentId, name: 'cached', goal: 'g',
    cadence: { emailsPerWeek: 1, spacingDays: 7 }, rationale: 'r', evidenceIds: [], suppressionNote: 'n', emails: [],
  }));
  return { planStart: CTX.planStart, planEnd: CTX.planEnd, generatedAt: 'x', source: 'cache', model: null, warnings: [], sequences: seqs };
}
