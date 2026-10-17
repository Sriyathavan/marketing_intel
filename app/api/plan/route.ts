import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CampaignPlan, PlanError, PlanRequest, PlanResponse } from '@/lib/types';
import { buildOpportunities } from '@/lib/opportunities';
import { buildSegmentProfiles } from '@/lib/segments';
import { loadContext, loadCustomers } from '@/lib/data';
import { SYSTEM_PROMPT, buildUserMessage } from '@/lib/prompt';
import { ModelPlanSchema, planJsonSchema, formatZodError, type ModelPlan } from '@/lib/planSchema';
import { postProcess, MODEL_ID } from '@/lib/guardrails';

export const runtime = 'nodejs';

const CACHE_WARNING = 'Claude unavailable: showing cached plan';

function err(error: string, code: PlanError['code'], status: number) {
  return NextResponse.json<PlanError>({ error, code }, { status });
}

async function cachedPlan(ids: string[], extraWarnings: string[]): Promise<CampaignPlan | null> {
  let cached: CampaignPlan;
  try {
    const raw = await readFile(path.join(process.cwd(), 'data', 'cached-plan.json'), 'utf8');
    cached = JSON.parse(raw) as CampaignPlan;
    if (!cached || !Array.isArray(cached.sequences)) return null;
  } catch {
    return null;
  }
  const warnings = [...(cached.warnings ?? []).filter((w) => w !== CACHE_WARNING), CACHE_WARNING, ...extraWarnings];
  let sequences = cached.sequences.filter((s) => ids.includes(s.opportunityId));
  if (sequences.length === 0) {
    sequences = cached.sequences;
    warnings.push('No cached sequences matched the requested opportunities; showing all cached sequences');
  }
  return { ...cached, source: 'cache', model: null, warnings, sequences };
}

async function callClaude(userMessage: string): Promise<ModelPlan> {
  const client = new Anthropic();
  const tools = [{
    name: 'submit_plan',
    description: 'Submit the complete 90-day email plan.',
    input_schema: planJsonSchema() as Anthropic.Tool.InputSchema,
  }];
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: `${userMessage}\n\nRespond only by calling the submit_plan tool with the complete plan.` }];
  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await client.messages.stream(
      {
        model: MODEL_ID,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        tools,
        tool_choice: { type: 'auto' },
        messages,
      },
      { timeout: 300000 },
    ).finalMessage();
    const block = res.content.find((b) => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') {
      lastError = 'No submit_plan tool call returned';
      messages.push({ role: 'assistant', content: res.content }, { role: 'user', content: `Error: ${lastError}. Call submit_plan.` });
      continue;
    }
    const parsed = ModelPlanSchema.safeParse(block.input);
    if (parsed.success) return parsed.data;
    lastError = formatZodError(parsed.error);
    messages.push(
      { role: 'assistant', content: res.content },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: block.id, is_error: true, content: `Schema validation failed. Fix and resubmit:\n${lastError}` }] },
    );
  }
  throw new Error(`invalid_output: ${lastError}`);
}

export async function POST(req: Request) {
  let body: PlanRequest;
  try {
    body = (await req.json()) as PlanRequest;
  } catch {
    return err('Invalid JSON body', 'bad_request', 400);
  }
  const ids = body?.opportunityIds;
  if (!Array.isArray(ids) || ids.length < 3 || ids.length > 5 || ids.some((i) => typeof i !== 'string') || new Set(ids).size !== ids.length) {
    return err('opportunityIds must be 3-5 unique ids', 'bad_request', 400);
  }

  const allOpps = buildOpportunities();
  const known = new Set(allOpps.map((o) => o.id));
  const unknown = ids.filter((i) => !known.has(i));
  if (unknown.length) return err(`Unknown opportunityIds: ${unknown.join(', ')}`, 'bad_request', 400);

  const fallback = async (extra: string[]) => {
    const plan = await cachedPlan(ids, extra);
    if (!plan) return err(`Claude failed and no cached plan is available${extra.length ? ': ' + extra.join('; ') : ''}`, 'claude_failed', 500);
    return NextResponse.json<PlanResponse>({ plan });
  };

  if (body.forceCache || !process.env.ANTHROPIC_API_KEY) return fallback([]);

  try {
    const opps = allOpps.filter((o) => ids.includes(o.id));
    const [ctx, customers] = await Promise.all([loadContext(), loadCustomers()]);
    const profiles = buildSegmentProfiles(customers);
    const modelPlan = await callClaude(buildUserMessage(opps, profiles, ctx));
    const plan = postProcess(modelPlan, { opportunities: opps, profiles, context: ctx });
    return NextResponse.json<PlanResponse>({ plan });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return fallback([`Claude error: ${msg.slice(0, 200)}`]);
  }
}
