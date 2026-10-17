import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { InsightsFile } from './types';

/** Loads the analyst's insights (regenerate with `npm run pipeline`). Server-side only. */
export async function getInsights(): Promise<InsightsFile> {
  const raw = await readFile(path.join(process.cwd(), 'data', 'insights.json'), 'utf8');
  const file = JSON.parse(raw) as InsightsFile;
  if (!file || !Array.isArray(file.insights)) throw new Error('data/insights.json is not a valid insights file');
  return file;
}
