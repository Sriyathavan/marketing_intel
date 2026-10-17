import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CTX, opp, profile, modelPlanFor, cachedPlanFor } from './_planFixtures';

const opps = [1, 2, 3, 4, 5].map((n) => opp(n));
const create = vi.fn();
const readFileMock = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({ default: class { messages = { stream: (...a: unknown[]) => ({ finalMessage: () => create(...a) }) }; } }));
vi.mock('@/lib/opportunities', () => ({ buildOpportunities: () => opps }));
vi.mock('@/lib/segments', () => ({ buildSegmentProfiles: () => [profile('seg_family')] }));
vi.mock('@/lib/data', () => ({ loadContext: async () => CTX, loadCustomers: async () => [] }));
vi.mock('node:fs/promises', () => ({ readFile: (...a: unknown[]) => readFileMock(...a), default: { readFile: (...a: unknown[]) => readFileMock(...a) } }));

import { POST } from '@/app/api/plan/route';

const ids = opps.slice(0, 3).map((o) => o.id);
const req = (body: unknown) => new Request('http://x/api/plan', { method: 'POST', body: JSON.stringify(body) });
const toolUse = (input: unknown) => ({ content: [{ type: 'tool_use', id: 'tu1', name: 'submit_plan', input }] });

beforeEach(() => {
  create.mockReset();
  readFileMock.mockReset();
  readFileMock.mockResolvedValue(JSON.stringify(cachedPlanFor(opps)));
  process.env.ANTHROPIC_API_KEY = 'test-key';
});
afterEach(() => { delete process.env.ANTHROPIC_API_KEY; });

describe('POST /api/plan', () => {
  it('400 on bad ids', async () => {
    expect((await POST(req({ opportunityIds: [] }))).status).toBe(400);
    const r = await POST(req({ opportunityIds: [ids[0], 'opp_nope'] }));
    expect(r.status).toBe(400);
    expect((await r.json()).code).toBe('bad_request');
    expect(create).not.toHaveBeenCalled();
  });
  it('accepts a single known id', async () => {
    create.mockResolvedValue(toolUse(modelPlanFor(opps.slice(0, 1))));
    const r = await POST(req({ opportunityIds: [ids[0]] }));
    expect(r.status).toBe(200);
  });
  it('valid Claude response -> source claude', async () => {
    create.mockResolvedValue(toolUse(modelPlanFor(opps.slice(0, 3))));
    const r = await POST(req({ opportunityIds: ids }));
    const { plan } = await r.json();
    expect(plan.source).toBe('claude');
    expect(plan.model).toBe('claude-sonnet-5-5');
    expect(plan.sequences).toHaveLength(3);
    expect(plan.sequences[0].suppressionNote).toContain('used for suppression only');
    expect(create.mock.calls[0][0].tool_choice).toEqual({ type: 'auto' });
    expect(create.mock.calls[0][0].max_tokens).toBe(16000);
  });
  it('invalid then valid -> retries and returns claude', async () => {
    create.mockResolvedValueOnce(toolUse({ sequences: [] })).mockResolvedValueOnce(toolUse(modelPlanFor(opps.slice(0, 3))));
    const { plan } = await (await POST(req({ opportunityIds: ids }))).json();
    expect(create).toHaveBeenCalledTimes(2);
    expect(plan.source).toBe('claude');
  });
  it('invalid twice -> cache', async () => {
    create.mockResolvedValue(toolUse({ sequences: [] }));
    const { plan } = await (await POST(req({ opportunityIds: ids }))).json();
    expect(create).toHaveBeenCalledTimes(2);
    expect(plan.source).toBe('cache');
    expect(plan.model).toBeNull();
    expect(plan.warnings).toContain('Claude unavailable: showing cached plan');
    expect(plan.sequences.map((s: any) => s.opportunityId)).toEqual(ids);
  });
  it('API error -> cache with warning', async () => {
    create.mockRejectedValue(new Error('boom'));
    const { plan } = await (await POST(req({ opportunityIds: ids }))).json();
    expect(plan.source).toBe('cache');
    expect(plan.warnings).toContain('Claude unavailable: showing cached plan');
  });
  it('missing key -> cache without calling Claude', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { plan } = await (await POST(req({ opportunityIds: ids }))).json();
    expect(plan.source).toBe('cache');
    expect(create).not.toHaveBeenCalled();
  });
  it('500 claude_failed when cache unreadable', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    readFileMock.mockRejectedValue(new Error('ENOENT'));
    const r = await POST(req({ opportunityIds: ids }));
    expect(r.status).toBe(500);
    expect((await r.json()).code).toBe('claude_failed');
  });
  it('cache with no matching ids returns all with warning', async () => {
    const other = cachedPlanFor([opps[3], opps[4]]);
    readFileMock.mockResolvedValue(JSON.stringify(other));
    delete process.env.ANTHROPIC_API_KEY;
    const { plan } = await (await POST(req({ opportunityIds: ids }))).json();
    expect(plan.sequences).toHaveLength(2);
    expect(plan.warnings.some((w: string) => /No cached sequences matched/.test(w))).toBe(true);
  });
});
