import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { RefreshEvent } from '@/lib/types';
import { runPipeline } from '@/lib/pipeline/run';
import { buildPackets } from '@/lib/pipeline/packets';
import { getInsights } from '@/lib/getInsights';

const create = vi.fn();
const client = { messages: { stream: (...a: unknown[]) => ({ finalMessage: () => create(...a) }) } } as any;
const toolUse = (name: string, input: unknown) => ({ content: [{ type: 'tool_use', id: 'tu', name, input }] });

const packets = buildPackets();
const evIds = packets.candidates[0].evidence.map((e) => e.id);
const trendId = packets.trends.keywords[0].id;
const insight = (n: number) => ({
  id: `ins_n${n}`, title: `Insight ${n}`, summary: 's', interest: 'hiking', segmentIds: ['seg_family'], trendIds: [trendId],
  momentum: 'rising', label: n % 2 ? 'observed' : 'interpreted', evidenceIds: [evIds[0]],
});
const insightsInput = { trendSummary: 't', customerSummary: 'c', insights: [1, 2, 3, 4, 5].map(insight) };
const slots = (aud: string[]) => aud.map((a, i) => ({
  key: `s${i + 1}`, name: `Seq ${i + 1}`, goal: 'g', segmentId: 'seg_family', audienceIds: [a], productLineIds: ['PL1'],
  insightIds: ['ins_n1'], windowStart: '2026-11-02', windowEnd: '2027-01-30', emailCount: 4,
}));
const emails = (start: string[]) => start.map((d, i) => ({
  step: i + 1, sendDate: d, sendTimeLocal: '07:00', subject: 'S', preheader: 'P', creativeDirection: 'c',
  cta: { label: 'Go', target: '/t' }, offerType: 'content_story', rationale: 'Proposed: r', evidenceIds: [evIds[0]],
}));
const seqInput = { rationale: 'r', evidenceIds: [evIds[0]], warnings: [], emails: emails(['2026-11-03', '2026-11-17', '2026-12-01', '2026-12-15']) };

/** Answers each tool by name. */
const route = (args: any) => {
  const tool = args.tools[0].name;
  if (tool === 'submit_insights') return toolUse(tool, insightsInput);
  if (tool === 'submit_calendar') return toolUse(tool, { sequences: slots(['A3', 'A1', 'A2', 'A5', 'A3', 'A1']), assumptions: ['seg_lapsed maps to A5'], warnings: [] });
  return toolUse(tool, seqInput);
};

beforeEach(() => { create.mockReset(); });

describe('runPipeline', () => {
  it('runs analyst then planner, emits events in order and writes both files', async () => {
    create.mockImplementation(route);
    const dir = await mkdtemp(path.join(tmpdir(), 'pipe-'));
    const events: RefreshEvent[] = [];
    const r = await runPipeline({ client, dataDir: dir, onEvent: (e) => events.push(e) });
    expect(events.map((e) => `${e.stage}:${'status' in e ? e.status : ''}`)).toEqual([
      'data:start', 'data:done', 'analyst:start', 'analyst:done', 'planner:start', 'planner:done', 'done:',
    ]);
    expect((events[1] as any).keywords).toHaveLength(packets.trends.keywords.length);
    expect((events[3] as any).insights).toBe(5);
    expect((events[5] as any).sequences).toBe(6);
    expect(r.plan.sequences.every((s) => s.audienceIds.length && s.productLineIds.length && s.startDate && s.durationDays > 0)).toBe(true);
    expect(JSON.parse(await readFile(path.join(dir, 'insights.json'), 'utf8')).insights).toHaveLength(5);
    expect(JSON.parse(await readFile(path.join(dir, 'cached-plan.json'), 'utf8')).assumptions).toEqual(['seg_lapsed maps to A5']);
    expect(create.mock.calls[0][0].tool_choice).toEqual({ type: 'auto' });
  });
  it('analyst never sees the brief; planner call includes it and not the raw data', async () => {
    create.mockImplementation(route);
    await runPipeline({ client, write: false });
    const byTool = (n: string) => create.mock.calls.filter((c) => c[0].tools[0].name === n).map((c) => JSON.stringify(c[0]));
    expect(byTool('submit_insights')[0]).not.toContain('Trailmark');
    expect(byTool('submit_insights')[0]).not.toContain('Channel Strategy Brief');
    expect(byTool('submit_calendar')[0]).toContain('Email Channel Strategy Brief');
    expect(byTool('submit_calendar')[0]).not.toContain('evidenceCatalog');
    expect(byTool('submit_sequence')).toHaveLength(6);
  });
  it('retries the analyst when evidence ids are unknown', async () => {
    const bad = { ...insightsInput, insights: insightsInput.insights.map((i) => ({ ...i, evidenceIds: ['ev_bogus'] })) };
    create.mockImplementationOnce(() => toolUse('submit_insights', bad)).mockImplementation(route);
    const r = await runPipeline({ client, write: false });
    expect(r.insights.insights).toHaveLength(5);
    expect(create.mock.calls[1][0].messages.at(-1).content[0].content).toContain('ev_bogus');
  });
  it('failure leaves previous files untouched and throws', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'pipe-'));
    await writeFile(path.join(dir, 'insights.json'), 'OLD');
    create.mockRejectedValue(new Error('boom'));
    const events: RefreshEvent[] = [];
    await expect(runPipeline({ client, dataDir: dir, onEvent: (e) => events.push(e) })).rejects.toThrow('boom');
    expect(await readFile(path.join(dir, 'insights.json'), 'utf8')).toBe('OLD');
    expect(events.some((e) => e.stage === 'done')).toBe(false);
  });
});

describe('getInsights', () => {
  it('reads data/insights.json', async () => {
    const f = await getInsights();
    expect(f.insights.length).toBeGreaterThanOrEqual(5);
  });
});
