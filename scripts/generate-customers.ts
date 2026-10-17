// Generates data/customers.json deterministically (mulberry32, seed 42).
// Run: npx tsx scripts/generate-customers.ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { INTERESTS } from '../lib/types';
import type { Customer, Interest, LifeEventType, SegmentId } from '../lib/types';
import { segmentOf } from '../lib/segments';

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(42);
const rnd = (lo: number, hi: number) => lo + rng() * (hi - lo);
const rint = (lo: number, hi: number) => Math.floor(rnd(lo, hi + 1));
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
const chance = (p: number) => rng() < p;
const r2 = (x: number) => Math.round(x * 100) / 100;
const r3 = (x: number) => Math.round(x * 1000) / 1000;
function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function weighted<T>(items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let x = rng() * total;
  for (const [v, w] of items) { if ((x -= w) <= 0) return v; }
  return items[items.length - 1][0];
}

const COUNTS: [SegmentId, number][] = [['seg_lapsed', 35], ['seg_new', 35], ['seg_premium', 30], ['seg_family', 40], ['seg_deal', 30], ['seg_mindful', 30]];
const BIAS: Record<SegmentId, Interest[]> = {
  seg_premium: ['snow_sports', 'eco_lodges', 'wildlife_safari'],
  seg_family: ['family_adventure', 'camping', 'water_sports'],
  seg_deal: ['hiking', 'camping', 'cycling'],
  seg_mindful: ['eco_lodges', 'hiking', 'cycling'],
  seg_new: [], seg_lapsed: [],
};
const SEND: Record<SegmentId, [Customer['email']['bestSendDay'], number]> = {
  seg_family: ['Sun', 19], seg_premium: ['Tue', 7], seg_deal: ['Thu', 12], seg_lapsed: ['Sat', 10], seg_new: ['Wed', 18], seg_mindful: ['Mon', 8],
};
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const PLACES: { country: 'US' | 'CA' | 'UK'; region: string; city: string; tz: string; zone: Customer['demographic']['climateZone']; lang?: 'en' | 'fr' | 'es' }[] = [
  { country: 'US', region: 'NY', city: 'New York', tz: 'America/New_York', zone: 'temperate' },
  { country: 'US', region: 'MA', city: 'Boston', tz: 'America/New_York', zone: 'cold' },
  { country: 'US', region: 'IL', city: 'Chicago', tz: 'America/Chicago', zone: 'cold' },
  { country: 'US', region: 'TX', city: 'Austin', tz: 'America/Chicago', zone: 'warm' },
  { country: 'US', region: 'CO', city: 'Denver', tz: 'America/Denver', zone: 'cold' },
  { country: 'US', region: 'AZ', city: 'Phoenix', tz: 'America/Phoenix', zone: 'arid', lang: 'es' },
  { country: 'US', region: 'WA', city: 'Seattle', tz: 'America/Los_Angeles', zone: 'temperate' },
  { country: 'US', region: 'CA', city: 'San Diego', tz: 'America/Los_Angeles', zone: 'warm' },
  { country: 'US', region: 'MN', city: 'Minneapolis', tz: 'America/Chicago', zone: 'cold' },
  { country: 'CA', region: 'ON', city: 'Toronto', tz: 'America/Toronto', zone: 'cold' },
  { country: 'CA', region: 'BC', city: 'Vancouver', tz: 'America/Vancouver', zone: 'temperate' },
  { country: 'CA', region: 'QC', city: 'Montreal', tz: 'America/Toronto', zone: 'cold', lang: 'fr' },
  { country: 'UK', region: 'ENG', city: 'London', tz: 'Europe/London', zone: 'temperate' },
  { country: 'UK', region: 'SCT', city: 'Edinburgh', tz: 'Europe/London', zone: 'cold' },
];
const BANDS = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'] as const;
const GEN: Record<(typeof BANDS)[number], Customer['demographic']['generation']> = { '18-24': 'GenZ', '25-34': 'Millennial', '35-44': 'Millennial', '45-54': 'GenX', '55-64': 'Boomer', '65+': 'Boomer' };
const NONSENS: LifeEventType[] = ['moving', 'engagement', 'wedding', 'anniversary', 'new_baby', 'graduation', 'new_job', 'retirement', 'empty_nest', 'birthday_soon'];
const SENS: LifeEventType[] = ['divorce', 'bereavement', 'health_journey'];
const TONES: Record<SegmentId, Customer['psychographic']['toneAffinity'][]> = {
  seg_premium: ['aspirational', 'aspirational', 'educational'], seg_family: ['playful', 'playful', 'educational'],
  seg_deal: ['no_nonsense', 'no_nonsense', 'playful'], seg_mindful: ['educational', 'educational', 'aspirational'],
  seg_new: ['playful', 'educational', 'aspirational'], seg_lapsed: ['no_nonsense', 'playful', 'educational'],
};
const date = (daysAgo: number) => new Date(Date.UTC(2026, 9, 1) - daysAgo * 86400000).toISOString().slice(0, 10);

function make(idx: number, seg: SegmentId): Customer {
  const place = weighted<(typeof PLACES)[number]>(PLACES.map((p) => [p, p.country === 'US' ? 4 : p.country === 'CA' ? 1.5 : 1.2]));
  const band = pick(BANDS);
  let comp: Customer['demographic']['household']['composition'];
  if (seg === 'seg_family') comp = weighted([['couple_kids', 5], ['single_parent', 2], ['multigenerational', 2]]);
  else comp = weighted<Customer['demographic']['household']['composition']>(seg === 'seg_premium' ? [['couple', 4], ['single', 3], ['couple_kids', 1]] : seg === 'seg_new' || seg === 'seg_lapsed' ? [['single', 3], ['couple', 3], ['couple_kids', 1.5], ['single_parent', 0.5]] : [['single', 3], ['couple', 4]]);
  const kids = comp === 'couple_kids' || comp === 'single_parent' || (comp === 'multigenerational' && chance(0.5));
  const kidsAgeBands = kids ? shuffle(['0-4', '5-12', '13-17'] as const).slice(0, rint(1, 2)) : [];
  const size = comp === 'single' ? 1 : comp === 'couple' ? 2 : comp === 'single_parent' ? 1 + kidsAgeBands.length : comp === 'couple_kids' ? 2 + rint(1, 3) : rint(4, 6);

  // interests
  const bias = BIAS[seg];
  const declared: Interest[] = [];
  const nInt = rint(1, 3);
  while (declared.length < nInt) {
    const i = bias.length && chance(0.75) ? pick(bias) : pick(INTERESTS);
    if (!declared.includes(i)) declared.push(i);
  }
  const clickByTopic: Customer['email']['clickByTopic'] = {};
  const engScale = seg === 'seg_lapsed' ? 0.3 : seg === 'seg_new' ? 0.7 : 1;
  for (const i of declared) if (chance(0.7)) clickByTopic[i] = r3(rnd(0.02, 0.18) * engScale);
  for (const i of INTERESTS) if (!declared.includes(i) && chance(0.08)) clickByTopic[i] = r3(rnd(0.01, 0.06) * engScale);
  const browsed = [...new Set([...declared.filter(() => chance(0.5)), ...INTERESTS.filter(() => chance(0.1))])];
  const wishlist = browsed.filter(() => chance(0.3));

  // transactional + loyalty per segment
  let recency: number, ltv: number, aov: number, freq: number, tier: Customer['loyalty']['tier'], stage: Customer['loyalty']['lifecycleStage'];
  let trend: Customer['email']['engagementTrend'], disc: number, style: Customer['psychographic']['buyingStyle'], click: number;
  const nonDeal = () => weighted<Customer['psychographic']['buyingStyle']>([['impulse', 2], ['researcher', 3], ['convenience_first', 2]]);
  const liveTrend = () => weighted<Customer['email']['engagementTrend']>([['active', 5], ['cooling', 2], ['reactivated', 1]]);
  switch (seg) {
    case 'seg_lapsed':
      trend = chance(0.6) ? 'dormant' : 'cooling'; recency = trend === 'dormant' ? rint(120, 700) : rint(280, 700);
      ltv = rint(200, 3500); aov = rint(500, 1800); freq = rint(0, 1); tier = chance(0.2) ? 'silver' : 'none'; stage = chance(0.8) ? 'lapsed' : 'repeat';
      disc = r2(rnd(0.1, 0.7)); style = chance(0.3) ? 'deal_hunter' : nonDeal(); click = rnd(0.005, 0.03); break;
    case 'seg_new': {
      trend = liveTrend(); const sub = chance(0.5); stage = sub ? 'subscriber_only' : 'first_time_buyer'; recency = sub ? rint(3, 120) : rint(10, 200);
      ltv = sub ? 0 : rint(300, 1800); aov = sub ? rint(300, 900) : ltv; freq = sub ? 0 : 1; tier = 'none';
      disc = sub ? 0 : r2(rnd(0, 0.6)); style = chance(0.25) ? 'deal_hunter' : nonDeal(); click = rnd(0.03, 0.08); break;
    }
    case 'seg_premium': {
      trend = liveTrend(); recency = rint(10, 200); stage = chance(0.5) ? 'vip' : 'repeat';
      const byLtv = chance(0.75); ltv = byLtv ? rint(4000, 14000) : rint(2000, 3900);
      tier = byLtv ? weighted([['none', 1], ['silver', 2], ['gold', 3], ['platinum', 2]]) : pick(['gold', 'platinum'] as const);
      aov = rint(1800, 5000); freq = rint(2, 6); disc = r2(rnd(0, 0.3)); style = chance(0.1) ? 'deal_hunter' : nonDeal(); click = rnd(0.05, 0.12); break;
    }
    case 'seg_family':
      trend = liveTrend(); recency = rint(15, 220); stage = chance(0.2) ? 'vip' : 'repeat'; ltv = rint(800, 3900);
      tier = pick(['none', 'none', 'silver'] as const); aov = rint(1200, 3000); freq = rint(1, 4); disc = r2(rnd(0.1, 0.6));
      style = chance(0.3) ? 'deal_hunter' : nonDeal(); click = rnd(0.04, 0.10); break;
    case 'seg_deal': {
      trend = liveTrend(); recency = rint(15, 230); stage = 'repeat'; ltv = rint(500, 3500); tier = pick(['none', 'none', 'silver'] as const);
      aov = rint(500, 1400); freq = rint(1, 5); const hunter = chance(0.6);
      style = hunter ? 'deal_hunter' : nonDeal(); disc = hunter ? r2(rnd(0.2, 0.9)) : r2(rnd(0.5, 0.9)); click = rnd(0.05, 0.11); break;
    }
    default:
      trend = liveTrend(); recency = rint(20, 240); stage = chance(0.15) ? 'vip' : 'repeat'; ltv = rint(600, 3500);
      tier = pick(['none', 'silver'] as const); aov = rint(900, 2200); freq = rint(1, 4); disc = r2(rnd(0.05, 0.45)); style = nonDeal(); click = rnd(0.04, 0.09);
  }
  const [sd, sh] = SEND[seg];
  const clustered = chance(0.65);
  const bestSendDay = clustered ? sd : pick(DAYS);
  const bestSendHour = clustered ? sh : Math.min(22, Math.max(6, sh + rint(-3, 3)));
  const fatigue = weighted<1 | 2 | 3>(
    seg === 'seg_lapsed' ? [[1, 8], [2, 2], [3, 0.5]] : seg === 'seg_family' ? [[1, 2], [2, 6], [3, 2]] : seg === 'seg_premium' ? [[1, 1], [2, 4], [3, 5]] : seg === 'seg_deal' ? [[1, 1], [2, 4], [3, 5]] : [[1, 2], [2, 5], [3, 3]],
  );
  const peak = declared.includes('snow_sports') ? pick([11, 12, 1, 2]) : chance(0.7) ? pick([1, 2, 3]) : rint(1, 12);
  const values: Customer['psychographic']['values'] = shuffle(['sustainability', 'local', 'value_for_money', 'premium_quality'] as const).slice(0, rint(1, 2));
  if (seg === 'seg_mindful' && !values.includes('sustainability')) values[0] = 'sustainability';
  if (seg === 'seg_deal' && !values.includes('value_for_money')) values[0] = 'value_for_money';
  if (seg === 'seg_premium' && !values.includes('premium_quality')) values[0] = 'premium_quality';

  return {
    id: `c_${String(idx).padStart(4, '0')}`,
    consent: { emailOptIn: true },
    demographic: {
      ageBand: band, generation: GEN[band], country: place.country, region: place.region, city: place.city,
      settlement: weighted([['urban', 4], ['suburban', 4], ['rural', 1.5]]), climateZone: place.zone, timeZone: place.tz,
      language: place.lang && chance(0.5) ? place.lang : 'en',
      household: { size, composition: comp, kidsAgeBands }, hasPets: chance(0.4),
      incomeBand: seg === 'seg_premium' ? pick(['100-150k', '150k+', '150k+']) : seg === 'seg_deal' ? pick(['<50k', '50-100k', '50-100k']) : pick(['<50k', '50-100k', '100-150k', '150k+']),
    },
    lifeEvents: chance(0.2) ? [{ type: pick(NONSENS), date: date(rint(5, 400)) }] : [],
    psychographic: {
      values, lifestyle: pick(['active', 'homebody', 'traveler', 'foodie', 'minimalist'] as const), buyingStyle: style,
      motivators: shuffle(['status', 'belonging', 'self_improvement', 'saving_money', 'novelty', 'nostalgia'] as const).slice(0, rint(1, 3)),
      toneAffinity: pick(TONES[seg]),
    },
    transactional: {
      recencyDays: recency, frequency12m: freq, monetary12m: Math.round(freq * aov * rnd(0.8, 1.1)), aov, ltv,
      predictedLtv: Math.round(ltv * rnd(1.05, 1.5) + (stage === 'subscriber_only' ? rint(300, 900) : 0)),
      tripTypesBought: stage === 'subscriber_only' ? [] : declared.filter(() => chance(0.7)),
      peakBookingMonth: peak, bookingLeadDays: rint(14, 150), discountUsageRate: disc,
      channel: weighted([['online', 5], ['app', 3], ['agent', 1.5]]), giftsForOthers: chance(0.15),
    },
    email: {
      openRate30d: r3(Math.min(0.9, click * rnd(4, 7) + 0.05)), clickRate30d: r3(click), clickByTopic, engagementTrend: trend,
      bestSendDay, bestSendHour, fatigueThresholdPerWeek: fatigue, device: weighted([['ios', 5], ['android', 3], ['desktop', 2]]),
    },
    site: { browsedInterests: browsed, abandonedBrowse: chance(0.2), wishlist },
    loyalty: { tier, lifecycleStage: stage, churnRisk: r2(seg === 'seg_lapsed' ? rnd(0.6, 0.95) : rnd(0.02, 0.5)), nps: chance(0.6) ? rint(-20, 90) : null },
    declared: {
      interests: declared,
      preferredContent: seg === 'seg_deal' ? 'deals' : seg === 'seg_premium' ? 'new_trips' : seg === 'seg_mindful' ? 'how_tos' : pick(['deals', 'new_trips', 'how_tos', 'stories'] as const),
      preferredFrequencyPerWeek: Math.min(fatigue, rint(1, 3)) as 1 | 2 | 3,
      goals: shuffle(['family time', 'new skills', 'disconnect', 'fitness', 'wildlife', 'low-impact travel', 'bucket list'].slice(0)).slice(0, rint(1, 2)),
    },
  };
}

const order: SegmentId[] = [];
for (const [s, n] of COUNTS) for (let i = 0; i < n; i++) order.push(s);
const customers = shuffle(order).map((s, i) => make(i + 1, s));

// 18 sensitive events spread across segments (round-robin over segment-sorted ids), 12 opt-outs from the rest.
const bySeg = new Map<SegmentId, Customer[]>();
for (const c of customers) { const s = segmentOf(c); bySeg.set(s, [...(bySeg.get(s) ?? []), c]); }
const sensitive = new Set<string>();
const pools = [...bySeg.values()].map((l) => [...l]);
for (let i = 0; sensitive.size < 18; i++) {
  const pool = pools[i % pools.length];
  const c = pool.shift();
  if (c) { sensitive.add(c.id); c.lifeEvents.push({ type: SENS[sensitive.size % 3], date: date(rint(20, 300)) }); }
}
const optPool = shuffle(customers.filter((c) => !sensitive.has(c.id)));
for (const c of optPool.slice(0, 12)) c.consent.emailOptIn = false;

const counts: Record<string, number> = {};
for (const c of customers) counts[segmentOf(c)] = (counts[segmentOf(c)] ?? 0) + 1;
for (const [s, n] of Object.entries(counts)) if (n < 20 || n > 50) throw new Error(`segment ${s} size ${n}`);
writeFileSync(join(__dirname, '..', 'data', 'customers.json'), JSON.stringify(customers, null, 1) + '\n');
console.log(counts, 'sensitive', sensitive.size);
