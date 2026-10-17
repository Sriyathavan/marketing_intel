import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CampaignPlan } from './types';
import { sortSequences } from './sequenceSpan';

/** Loads the pre-generated plan (regenerate with `npm run pipeline`). Server-side only. */
export async function getPlan(): Promise<CampaignPlan> {
  const raw = await readFile(path.join(process.cwd(), 'data', 'cached-plan.json'), 'utf8');
  const plan = JSON.parse(raw) as CampaignPlan;
  if (!plan || !Array.isArray(plan.sequences)) throw new Error('data/cached-plan.json is not a valid plan');
  return { ...plan, sequences: sortSequences(plan.sequences) };
}
