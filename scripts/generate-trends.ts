// Generates data/trends.json deterministically. Run: npx tsx scripts/generate-trends.ts
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TrendsFile, TrendKeyword, Interest } from '../lib/types';

const SEASON: Record<string, number[]> = {
  hiking:   [0.6, 0.6, 0.8, 1.1, 1.3, 1.4, 1.4, 1.3, 1.2, 1.0, 0.7, 0.6],
  camping:  [0.5, 0.5, 0.7, 1.0, 1.3, 1.6, 1.7, 1.5, 1.1, 0.8, 0.5, 0.5],
  winterCamp: [1.4, 1.2, 0.9, 0.6, 0.5, 0.4, 0.4, 0.5, 0.7, 1.0, 1.4, 1.6],
  snow:     [1.5, 1.45, 1.0, 0.65, 0.5, 0.5, 0.5, 0.5, 0.6, 0.8, 1.1, 1.5],
  water:    [0.4, 0.4, 0.6, 0.9, 1.3, 1.7, 1.8, 1.6, 1.0, 0.7, 0.4, 0.4],
  cycling:  [0.5, 0.5, 0.8, 1.1, 1.4, 1.6, 1.6, 1.4, 1.1, 0.8, 0.5, 0.4],
  wildlife: [0.9, 0.9, 1.0, 1.1, 1.0, 1.0, 1.1, 1.1, 1.0, 1.0, 0.9, 1.0],
  family:   [0.8, 0.9, 1.1, 1.0, 1.1, 1.4, 1.4, 1.2, 0.8, 0.8, 0.9, 1.2],
  eco:      [0.9, 0.9, 1.0, 1.1, 1.1, 1.0, 1.0, 1.0, 1.0, 1.0, 0.9, 1.0],
};

interface Def { id: string; term: string; interest: Interest; season: string; yoy: number; peak: number; rising: { query: string; growth: number | 'breakout' }[] }
const DEFS: Def[] = [
  { id: 'tr_hiking_trails_near_me', term: 'hiking trails near me', interest: 'hiking', season: 'hiking', yoy: 8, peak: 92, rising: [{ query: 'easy hikes with kids', growth: 120 }, { query: 'winter hiking boots', growth: 90 }] },
  { id: 'tr_backpacking_trips', term: 'backpacking trips', interest: 'hiking', season: 'hiking', yoy: 34, peak: 70, rising: [{ query: 'patagonia backpacking', growth: 'breakout' }, { query: 'guided backpacking tour', growth: 140 }] },
  { id: 'tr_winter_camping', term: 'winter camping', interest: 'camping', season: 'winterCamp', yoy: 41, peak: 66, rising: [{ query: 'heated tent camping', growth: 'breakout' }, { query: 'winter camping gear list', growth: 160 }] },
  { id: 'tr_van_life_trips', term: 'van life trips', interest: 'camping', season: 'camping', yoy: 12, peak: 74, rising: [{ query: 'van rental national parks', growth: 85 }, { query: 'campervan winter', growth: 60 }] },
  { id: 'tr_ski_passes', term: 'ski passes', interest: 'snow_sports', season: 'snow', yoy: -3, peak: 96, rising: [{ query: 'multi-resort ski pass', growth: 70 }, { query: 'ski pass deals', growth: 55 }] },
  { id: 'tr_snowshoe_tours', term: 'snowshoe tours', interest: 'snow_sports', season: 'snow', yoy: 28, peak: 58, rising: [{ query: 'guided snowshoe hike', growth: 150 }, { query: 'snowshoe lodge package', growth: 'breakout' }] },
  { id: 'tr_kayak_tours', term: 'kayak tours', interest: 'water_sports', season: 'water', yoy: 5, peak: 84, rising: [{ query: 'sea kayak tour baja', growth: 110 }, { query: 'family kayak trip', growth: 75 }] },
  { id: 'tr_bikepacking', term: 'bikepacking', interest: 'cycling', season: 'cycling', yoy: 52, peak: 72, rising: [{ query: 'bikepacking routes', growth: 180 }, { query: 'gravel bike tour', growth: 'breakout' }] },
  { id: 'tr_wildlife_safari', term: 'wildlife safari', interest: 'wildlife_safari', season: 'wildlife', yoy: 38, peak: 78, rising: [{ query: 'safari with kids', growth: 130 }, { query: 'small group safari', growth: 'breakout' }] },
  { id: 'tr_family_adventure_trips', term: 'family adventure trips', interest: 'family_adventure', season: 'family', yoy: 18, peak: 80, rising: [{ query: 'multigenerational vacation', growth: 105 }, { query: 'family winter getaway', growth: 80 }] },
  { id: 'tr_eco_lodges', term: 'eco lodges', interest: 'eco_lodges', season: 'eco', yoy: 30, peak: 64, rising: [{ query: 'eco lodge costa rica', growth: 145 }, { query: 'off grid lodge stay', growth: 'breakout' }] },
  { id: 'tr_sustainable_travel', term: 'sustainable travel', interest: 'eco_lodges', season: 'eco', yoy: 21, peak: 68, rising: [{ query: 'carbon neutral trips', growth: 95 }, { query: 'responsible tour operators', growth: 70 }] },
];

function normalize(a: number[]): number[] {
  const m = a.reduce((s, x) => s + x, 0) / a.length;
  const n = a.map((x) => Math.round((x / m) * 1000) / 1000);
  // fix rounding drift so mean is exactly 1.0 (to 3 dp)
  const drift = Math.round((12 - n.reduce((s, x) => s + x, 0)) * 1000) / 1000;
  n[n.indexOf(Math.max(...n))] = Math.round((Math.max(...n) + drift) * 1000) / 1000;
  return n;
}

function noise(i: number, k: number): number {
  return 1 + 0.035 * Math.sin(i * 2.3 + k * 1.7) + 0.02 * Math.cos(i * 0.9 + k);
}

export function yoyFromSeries(values: number[]): number {
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  return Math.round((mean(values.slice(12)) / mean(values.slice(0, 12)) - 1) * 100);
}

const keywords: TrendKeyword[] = DEFS.map((d, k) => {
  const seas = normalize(SEASON[d.season]);
  const raw: number[] = [];
  for (let i = 0; i < 24; i++) {
    const month = (9 + i) % 12; // series starts 2024-10
    raw.push(seas[month] * Math.exp((Math.log(1 + d.yoy / 100) * (i - 11.5)) / 12) * noise(i, k));
  }
  const scale = d.peak / Math.max(...raw);
  const series = raw.map((r, i) => {
    const y = 2024 + Math.floor((9 + i) / 12);
    const m = ((9 + i) % 12) + 1;
    return { month: `${y}-${String(m).padStart(2, '0')}`, value: Math.max(1, Math.min(100, Math.round(r * scale))) };
  });
  return { id: d.id, term: d.term, interest: d.interest, series, seasonalityIndex: seas, yoyPct: yoyFromSeries(series.map((s) => s.value)), risingQueries: d.rising };
});

const file: TrendsFile = { source: 'curated snapshot modelled on Google Trends (not live)', capturedAt: '2026-10-01', geo: 'US', keywords };
writeFileSync(join(__dirname, '..', 'data', 'trends.json'), JSON.stringify(file, null, 2) + '\n');
console.log(keywords.map((k) => `${k.id} ${k.yoyPct}`).join('\n'));
