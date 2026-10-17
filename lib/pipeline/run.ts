import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import type { CampaignPlan, InsightsFile, RefreshEvent } from '../types';
import { buildPackets } from './packets';
import { runAnalyst } from './analyst';
import { loadBrief, runPlanner } from './planner';
import type { Thinking } from './llm';

export interface PipelineOptions {
  onEvent?: (e: RefreshEvent) => void;
  client?: Anthropic;
  dataDir?: string;
  analystModel?: string;
  plannerModel?: string;
  analystThinking?: Thinking;
  plannerThinking?: Thinking;
  /** Set false to skip writing data files (benchmarks). */
  write?: boolean;
}

export interface PipelineResult {
  insights: InsightsFile;
  plan: CampaignPlan;
  timingsMs: { analyst: number; planner: number; total: number };
}

/** Writes both files to temp names first, then renames, so a failure leaves the previous files untouched. */
async function writeAtomically(dir: string, files: Record<string, unknown>) {
  await mkdir(dir, { recursive: true });
  const tmp = Object.keys(files).map((name) => ({ name, tmp: path.join(dir, `.${name}.${process.pid}.tmp`) }));
  await Promise.all(tmp.map((t) => writeFile(t.tmp, JSON.stringify(files[t.name], null, 2) + '\n')));
  for (const t of tmp) await rename(t.tmp, path.join(dir, t.name));
}

/** Data packets -> analyst -> planner -> data/insights.json + data/cached-plan.json. */
export async function runPipeline(opts: PipelineOptions = {}): Promise<PipelineResult> {
  const emit = opts.onEvent ?? (() => {});
  const t0 = Date.now();

  emit({ stage: 'data', status: 'start' });
  const packets = buildPackets();
  emit({ stage: 'data', status: 'done', keywords: packets.trends.keywords.map((k) => k.term) });

  emit({ stage: 'analyst', status: 'start' });
  const insights = await runAnalyst(packets, { model: opts.analystModel, thinking: opts.analystThinking, client: opts.client });
  const tAnalyst = Date.now();
  emit({ stage: 'analyst', status: 'done', insights: insights.insights.length });

  emit({ stage: 'planner', status: 'start' });
  const brief = await loadBrief();
  const plan = await runPlanner(insights, packets.context, packets.profiles, brief, { model: opts.plannerModel, thinking: opts.plannerThinking, client: opts.client });
  const tPlanner = Date.now();
  emit({ stage: 'planner', status: 'done', sequences: plan.sequences.length });

  if (opts.write !== false) {
    await writeAtomically(opts.dataDir ?? path.join(process.cwd(), 'data'), { 'insights.json': insights, 'cached-plan.json': plan });
  }
  emit({ stage: 'done' });
  return { insights, plan, timingsMs: { analyst: tAnalyst - t0, planner: tPlanner - tAnalyst, total: Date.now() - t0 } };
}
