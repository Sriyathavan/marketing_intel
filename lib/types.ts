export type ISODate = string; // YYYY-MM-DD
export const INTERESTS = ['hiking','camping','snow_sports','water_sports','cycling','wildlife_safari','family_adventure','eco_lodges'] as const;
export type Interest = typeof INTERESTS[number];
export type SegmentId = 'seg_lapsed'|'seg_new'|'seg_premium'|'seg_family'|'seg_deal'|'seg_mindful';
export type OfferType = 'content_story'|'early_access'|'promo_discount'|'new_trip_launch'|'bundle';

// ---------- data/trends.json ----------
export interface TrendsFile {
  source: 'curated snapshot modelled on Google Trends (not live)';
  capturedAt: ISODate;
  geo: 'US';
  keywords: TrendKeyword[];
}
export interface TrendKeyword {
  id: string;
  term: string;
  interest: Interest;
  series: { month: string; value: number }[]; // 24 pts "YYYY-MM", 0-100, ending 2026-09
  seasonalityIndex: number[];                 // length 12, Jan..Dec, mean = 1.0
  yoyPct: number;
  risingQueries: { query: string; growth: number | 'breakout' }[];
}

// ---------- data/customers.json ----------
export type LifeEventType = 'moving'|'engagement'|'wedding'|'anniversary'|'new_baby'|'graduation'|'new_job'|'retirement'|'empty_nest'|'birthday_soon'
  | 'divorce'|'bereavement'|'health_journey'; // last 3 are SENSITIVE
export const SENSITIVE_EVENTS: LifeEventType[] = ['divorce','bereavement','health_journey'];
export interface Customer {
  id: string;
  consent: { emailOptIn: boolean };
  demographic: {
    ageBand: '18-24'|'25-34'|'35-44'|'45-54'|'55-64'|'65+';
    generation: 'GenZ'|'Millennial'|'GenX'|'Boomer';
    country: 'US'|'CA'|'UK'; region: string; city: string;
    settlement: 'urban'|'suburban'|'rural';
    climateZone: 'cold'|'temperate'|'warm'|'arid';
    timeZone: string; language: 'en'|'es'|'fr';
    household: { size: number; composition: 'single'|'couple'|'couple_kids'|'single_parent'|'multigenerational'; kidsAgeBands: ('0-4'|'5-12'|'13-17')[] };
    hasPets: boolean;
    incomeBand: '<50k'|'50-100k'|'100-150k'|'150k+';
  };
  lifeEvents: { type: LifeEventType; date: ISODate }[];
  psychographic: {
    values: ('sustainability'|'local'|'value_for_money'|'premium_quality')[];
    lifestyle: 'active'|'homebody'|'traveler'|'foodie'|'minimalist';
    buyingStyle: 'impulse'|'researcher'|'deal_hunter'|'convenience_first';
    motivators: ('status'|'belonging'|'self_improvement'|'saving_money'|'novelty'|'nostalgia')[];
    toneAffinity: 'playful'|'aspirational'|'educational'|'no_nonsense';
  };
  transactional: {
    recencyDays: number; frequency12m: number; monetary12m: number;
    aov: number; ltv: number; predictedLtv: number;
    tripTypesBought: Interest[];
    peakBookingMonth: number;
    bookingLeadDays: number;
    discountUsageRate: number;
    channel: 'online'|'app'|'agent';
    giftsForOthers: boolean;
  };
  email: {
    openRate30d: number; clickRate30d: number;
    clickByTopic: Partial<Record<Interest, number>>;
    engagementTrend: 'active'|'cooling'|'dormant'|'reactivated';
    bestSendDay: 'Mon'|'Tue'|'Wed'|'Thu'|'Fri'|'Sat'|'Sun';
    bestSendHour: number;
    fatigueThresholdPerWeek: 1|2|3;
    device: 'ios'|'android'|'desktop';
  };
  site: { browsedInterests: Interest[]; abandonedBrowse: boolean; wishlist: Interest[] };
  loyalty: {
    tier: 'none'|'silver'|'gold'|'platinum';
    lifecycleStage: 'subscriber_only'|'first_time_buyer'|'repeat'|'vip'|'lapsed';
    churnRisk: number;
    nps: number | null;
  };
  declared: {
    interests: Interest[]; preferredContent: 'deals'|'new_trips'|'how_tos'|'stories';
    preferredFrequencyPerWeek: 1|2|3; goals: string[];
  };
}

// ---------- data/context.json ----------
export interface ContextFile {
  planStart: ISODate; planEnd: ISODate;
  hemisphere: 'north';
  seasons: { name: 'autumn'|'winter'|'spring'|'summer'; start: ISODate; end: ISODate }[];
  holidays: { id: string; name: string; date: ISODate; kind: 'shopping'|'cultural'|'public'; demandBoost: number }[];
  launches: { id: string; name: string; date: ISODate; interest: Interest; inventoryConstrained: boolean }[];
  paydays: string;
  sendBlackouts: ISODate[];
}

// ---------- segments / evidence / scoring ----------
export interface SegmentProfile {
  id: SegmentId; name: string; definition: string;
  size: number;
  eligible: number;
  suppressedSensitive: number;
  optedOut: number;
  meanClickRate: number; meanAov: number; meanLtv: number;
  fatigueShare: number;
  fatigueCapPerWeek: 1|2|3;
  modalSendDay: Customer['email']['bestSendDay']; modalSendHour: number;
  topInterests: { interest: Interest; share: number }[];
  dominantTone: Customer['psychographic']['toneAffinity'];
}
export type EvidenceKind = 'trend'|'segment'|'seasonality'|'calendar'|'engagement';
export interface Evidence {
  id: string; kind: EvidenceKind; label: string;
  value: number | string; unit?: string;
  source: { file: 'trends.json'|'customers.json'|'context.json'; ref: string };
}
export type FactorKey = 'trendMomentum'|'segmentFit'|'seasonalTiming'|'revenuePotential'|'effortRisk';
export interface ScoreFactor {
  key: FactorKey; label: string; weight: number;
  score: number;
  contribution: number;
  inputs: Record<string, number>;
  explanation: string;
}
export interface ScoreBreakdown { total: number; factors: ScoreFactor[]; }
export interface ScoringInput {
  yoyPct: number; recentSlopePct: number;
  affinityShare: number; meanClickRate: number;
  avgSeasonIdx: number; bookingWindowShare: number;
  reachable: number; meanAov: number;
  offerType: OfferType; fatigueShare: number; inventoryConstrained: boolean;
}
export interface Opportunity {
  id: string; rank: number; title: string; thesis: string;
  interest: Interest; trendIds: string[]; segmentId: SegmentId;
  offerType: OfferType; windowStart: ISODate; windowEnd: ISODate;
  reachable: number;
  evidence: Evidence[];
  score: ScoreBreakdown;
}

// ---------- plan ----------
export type ReviewStatus = 'proposed'|'approved'|'rejected';
export interface EmailCampaign {
  id: string; sequenceId: string; opportunityId: string; segmentId: SegmentId;
  step: number;
  sendDate: ISODate; sendTimeLocal: string;
  subject: string; preheader: string;
  creativeDirection: string; cta: { label: string; target: string };
  offerType: OfferType; rationale: string; evidenceIds: string[];
  status: ReviewStatus; editedByUser: boolean;
  guardrailFlags: string[];
}
export interface EmailSequence {
  id: string; opportunityId: string; segmentId: SegmentId; name: string; goal: string;
  cadence: { emailsPerWeek: number; spacingDays: number };
  rationale: string;
  evidenceIds: string[]; suppressionNote: string;
  emails: EmailCampaign[];
}
export interface CampaignPlan {
  planStart: ISODate; planEnd: ISODate; generatedAt: string;
  source: 'claude'|'cache'; model: string | null; warnings: string[];
  sequences: EmailSequence[];
}

// ---------- API ----------
export interface PlanRequest { opportunityIds: string[]; planStart?: ISODate }
export interface PlanResponse { plan: CampaignPlan }
export interface PlanError { error: string; code: 'bad_request'|'claude_failed'|'invalid_output'; }
