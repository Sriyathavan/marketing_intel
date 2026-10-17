import { describe, it, expect } from 'vitest';
import { sequenceSpan, sortSequences, spanSentence } from '../lib/sequenceSpan';
import { applyRefreshEvent, parseNdjson, startRefresh } from '../lib/refreshProgress';
import type { EmailSequence } from '../lib/types';

const seq = (id: string, dates: string[], extra: Partial<EmailSequence> = {}): EmailSequence => ({
  id, opportunityId: 'o', segmentId: 'seg_family', name: id, goal: 'g',
  startDate: '', endDate: '', durationDays: 0, audienceIds: [], productLineIds: [],
  cadence: { emailsPerWeek: 0.4, spacingDays: 0 }, rationale: '', evidenceIds: [], suppressionNote: '',
  emails: dates.map((d, i) => ({ id: `${id}_${i}`, sequenceId: id, sendDate: d } as never)), ...extra,
});

describe('sequence span', () => {
  it('uses plan fields when present', () => {
    const s = seq('a', ['2026-11-03', '2026-12-09'], { startDate: '2026-11-03', endDate: '2026-12-09', durationDays: 37, cadence: { emailsPerWeek: 1, spacingDays: 7 } });
    expect(spanSentence(sequenceSpan(s))).toBe('Runs Nov 3 to Dec 9 (37 days), 2 emails, about every 7 days');
  });
  it('falls back to email dates and never prints a per-week figure', () => {
    const s = seq('a', ['2026-11-03', '2026-11-10', '2026-11-17']);
    const i = sequenceSpan(s);
    expect(i.days).toBe(15);
    expect(i.spacingDays).toBe(7);
    expect(spanSentence(i)).not.toMatch(/per week|0\.4/);
  });
  it('sorts sequences by earliest start date', () => {
    const o = sortSequences([seq('b', ['2026-11-10']), seq('a', ['2026-11-03']), seq('c', ['2026-11-03'])]);
    expect(o.map(x => x.id)).toEqual(['a', 'c', 'b']);
  });
});

describe('refresh progress', () => {
  it('parses NDJSON across chunk boundaries', () => {
    const a = parseNdjson('{"stage":"data","status":"start"}\n{"stage":"da');
    expect(a.events).toHaveLength(1);
    const b = parseNdjson(a.rest + 'ta","status":"done","keywords":["x"]}\nnot json\n');
    expect(b.events).toHaveLength(1);
  });
  it('walks the stages', () => {
    let s = applyRefreshEvent(startRefresh, { stage: 'data', status: 'start', keywords: ['hiking'] });
    expect(s.data).toBe('running'); expect(s.keywords).toEqual(['hiking']);
    s = applyRefreshEvent(s, { stage: 'analyst', status: 'start' });
    expect(s.data).toBe('done'); expect(s.analyst).toBe('running');
    s = applyRefreshEvent(s, { stage: 'done' });
    expect(s.phase).toBe('done'); expect(s.planner).toBe('done');
    expect(applyRefreshEvent(s, { stage: 'error', message: 'x' }).error).toBe('x');
  });
});
