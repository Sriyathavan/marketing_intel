import type { CampaignPlan, ContextFile, Opportunity, SegmentProfile, SegmentId } from '@/lib/types';
import type { CalendarSlot, ModelSequence } from '@/lib/planSchema';
import type { PlannedSequence } from '@/lib/guardrails';

export const CTX: ContextFile = {
  planStart: '2026-11-02', planEnd: '2027-01-30', hemisphere: 'north', seasons: [],
  holidays: [{ id: 'h1', name: 'Black Friday', date: '2026-11-27', kind: 'shopping', demandBoost: 1.5 }],
  launches: [], paydays: '1st and 15th', sendBlackouts: ['2026-11-26', '2026-12-24', '2026-12-25', '2026-12-26'],
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

export const EVIDENCE = ['ev_a', 'ev_b', 'ev_c'];

export function slot(key = 's1', over: Partial<CalendarSlot> = {}): CalendarSlot {
  return {
    key, name: `Seq ${key}`, goal: 'g', segmentId: 'seg_family', audienceIds: ['A3'], productLineIds: ['PL1'],
    insightIds: ['ins_one'], windowStart: '2026-11-02', windowEnd: '2027-01-30', emailCount: 4, ...over,
  };
}

export function modelEmail(step: number, date: string, over: Record<string, unknown> = {}) {
  return {
    step, sendDate: date, sendTimeLocal: '07:00', subject: `Subject ${step}`, preheader: 'Pre', creativeDirection: 'Hero shot',
    cta: { label: 'Go', target: '/trips' }, offerType: 'bundle' as const, rationale: 'Because', evidenceIds: [EVIDENCE[0]], ...over,
  };
}

export function modelSequence(dates = ['2026-11-03', '2026-11-12', '2026-11-24', '2026-12-08']): ModelSequence {
  return { rationale: 'r', evidenceIds: [EVIDENCE[0]], warnings: [], emails: dates.map((d, i) => modelEmail(i + 1, d)) };
}

export function planned(key = 's1', dates?: string[], over: Partial<CalendarSlot> = {}): PlannedSequence {
  return { slot: slot(key, over), model: modelSequence(dates), allowedEvidence: EVIDENCE };
}

export function cachedPlanFor(opps: Opportunity[]): CampaignPlan {
  const seqs = opps.map((o) => ({
    id: `seq_${o.id}`, opportunityId: o.id, segmentId: o.segmentId, name: 'cached', goal: 'g',
    startDate: CTX.planStart, endDate: CTX.planStart, durationDays: 1, audienceIds: ['A3'], productLineIds: ['PL1'],
    cadence: { emailsPerWeek: 1, spacingDays: 7 }, rationale: 'r', evidenceIds: [], suppressionNote: 'n', emails: [],
  }));
  return { planStart: CTX.planStart, planEnd: CTX.planEnd, generatedAt: 'x', source: 'cache', model: null, warnings: [], assumptions: [], sequences: seqs };
}
