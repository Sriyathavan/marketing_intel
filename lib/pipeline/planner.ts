import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CampaignPlan, ContextFile, InsightsFile, SegmentProfile } from '../types';
import { CalendarSchema, ModelSequenceSchema, type CalendarSlot } from '../planSchema';
import { PLANNER_SYSTEM, calendarUser, sequenceUser, type PlannerInputs } from '../prompt';
import { postProcess, type PlannedSequence } from '../guardrails';
import { callTool, type LlmOptions } from './llm';

/** Benchmarked fastest planner model: about 12s for the per-sequence fan-out with schema-valid output. */
export const PLANNER_MODEL = 'claude-haiku-5-5';

export async function loadBrief(): Promise<string> {
  return readFile(path.join(process.cwd(), 'Email strategy Brief.md'), 'utf8');
}

/**
 * Step 2: the planner sees ONLY the insights, the brief, the calendar context and segment aggregates.
 * 2a decides the calendar skeleton (one call); 2b writes each sequence in parallel (one call per sequence).
 */
export async function runPlanner(
  insights: InsightsFile,
  context: ContextFile,
  profiles: SegmentProfile[],
  brief: string,
  opts: Partial<LlmOptions> = {},
): Promise<CampaignPlan> {
  const model = opts.model ?? PLANNER_MODEL;
  const llm: LlmOptions = { model, thinking: opts.thinking, client: opts.client };
  const inputs: PlannerInputs = { brief, insights, context, profiles };
  const insightById = new Map(insights.insights.map((i) => [i.id, i]));
  const segIds = new Set(profiles.map((p) => p.id));

  const calendar = await callTool(llm, {
    system: PLANNER_SYSTEM,
    user: calendarUser(inputs),
    toolName: 'submit_calendar',
    toolDescription: 'Submit the 90-day sequence calendar, assumptions and warnings.',
    schema: CalendarSchema,
    maxTokens: 6000,
    validate: (c) => {
      const bad = c.sequences.flatMap((s) => s.insightIds.filter((i) => !insightById.has(i)));
      if (bad.length) return `Unknown insightIds: ${[...new Set(bad)].join(', ')}`;
      const badSeg = c.sequences.filter((s) => !segIds.has(s.segmentId));
      if (badSeg.length) return `Unknown segmentId in: ${badSeg.map((s) => s.key).join(', ')}`;
      if (new Set(c.sequences.map((s) => s.key)).size !== c.sequences.length) return 'Sequence keys must be unique (s1, s2, ...)';
      return null;
    },
  });

  const slots: CalendarSlot[] = calendar.sequences.map((s) => ({
    ...s,
    windowStart: s.windowStart < context.planStart ? context.planStart : s.windowStart,
    windowEnd: s.windowEnd > context.planEnd ? context.planEnd : s.windowEnd,
  }));

  const planned: PlannedSequence[] = await Promise.all(
    slots.map(async (slot) => {
      const allowedEvidence = [...new Set(slot.insightIds.flatMap((id) => insightById.get(id)?.evidenceIds ?? []))];
      const model = await callTool(llm, {
        system: PLANNER_SYSTEM,
        user: sequenceUser(inputs, slot, slots.filter((o) => o.key !== slot.key)),
        toolName: 'submit_sequence',
        toolDescription: 'Submit the emails for this one sequence.',
        schema: ModelSequenceSchema,
        maxTokens: 6000,
      });
      return { slot, model, allowedEvidence };
    }),
  );

  return postProcess(planned, { profiles, context, model, assumptions: calendar.assumptions, warnings: calendar.warnings });
}
