import type { InsightsFile } from '../types';
import { ModelInsightsSchema } from '../planSchema';
import { ANALYST_SYSTEM, analystUser } from '../prompt';
import { callTool, type LlmOptions } from './llm';
import type { Packets } from './packets';
import { evidenceIdSet } from './packets';

export const ANALYST_MODEL = 'claude-haiku-5-5';

/**
 * Step 1: the analyst sees only data packets (never the strategy brief) and returns insights
 * whose evidence ids and trend ids are checked against the deterministic evidence layer.
 */
export async function runAnalyst(packets: Packets, opts: Partial<LlmOptions> = {}): Promise<InsightsFile> {
  const model = opts.model ?? ANALYST_MODEL;
  const validEvidence = evidenceIdSet(packets.candidates);
  const validTrends = new Set(packets.trends.keywords.map((k) => k.id));
  const out = await callTool(
    { model, thinking: opts.thinking, client: opts.client },
    {
      system: ANALYST_SYSTEM,
      user: analystUser(packets.analystPayload),
      toolName: 'submit_insights',
      toolDescription: 'Submit the trend summary, customer summary and labelled insights.',
      schema: ModelInsightsSchema,
      maxTokens: 6000,
      validate: (v) => {
        const badEv = v.insights.flatMap((i) => i.evidenceIds.filter((e) => !validEvidence.has(e)));
        if (badEv.length) return `Unknown evidenceIds (use only ids from evidenceCatalog): ${[...new Set(badEv)].join(', ')}`;
        const badTr = v.insights.flatMap((i) => i.trendIds.filter((t) => !validTrends.has(t)));
        if (badTr.length) return `Unknown trendIds: ${[...new Set(badTr)].join(', ')}`;
        if (new Set(v.insights.map((i) => i.id)).size !== v.insights.length) return 'Insight ids must be unique';
        return null;
      },
    },
  );
  return { generatedAt: new Date().toISOString(), model, ...out };
}
