import { describe, it, expect } from 'vitest';
import { ModelSequenceSchema, CalendarSchema, ModelInsightsSchema, toolJsonSchema } from '@/lib/planSchema';
import { modelSequence, slot } from './_planFixtures';

describe('ModelSequenceSchema', () => {
  it('accepts a valid sequence', () => {
    expect(ModelSequenceSchema.safeParse(modelSequence()).success).toBe(true);
  });
  it('rejects subject over 70 and preheader over 110 chars', () => {
    const p = modelSequence(); p.emails[0].subject = 'x'.repeat(71);
    expect(ModelSequenceSchema.safeParse(p).success).toBe(false);
    const q = modelSequence(); q.emails[0].preheader = 'x'.repeat(111);
    expect(ModelSequenceSchema.safeParse(q).success).toBe(false);
  });
  it('rejects fewer than 4 or more than 6 emails', () => {
    const p = modelSequence(); p.emails.pop();
    expect(ModelSequenceSchema.safeParse(p).success).toBe(false);
    expect(ModelSequenceSchema.safeParse(modelSequence(Array(7).fill('2026-11-03'))).success).toBe(false);
  });
  it('requires evidence and valid enums, date and time formats', () => {
    const p = modelSequence(); p.emails[0].evidenceIds = [];
    expect(ModelSequenceSchema.safeParse(p).success).toBe(false);
    const q = modelSequence(); (q.emails[0] as any).offerType = 'nope';
    expect(ModelSequenceSchema.safeParse(q).success).toBe(false);
    const r = modelSequence(); r.emails[0].sendDate = '11/03/2026';
    expect(ModelSequenceSchema.safeParse(r).success).toBe(false);
    const t = modelSequence(); t.emails[0].sendTimeLocal = '7am';
    expect(ModelSequenceSchema.safeParse(t).success).toBe(false);
  });
});

describe('CalendarSchema', () => {
  const cal = () => ({ sequences: Array.from({ length: 6 }, (_, i) => slot(`s${i + 1}`)), assumptions: ['a'], warnings: [] });
  it('accepts a calendar and requires brief audience/product ids', () => {
    expect(CalendarSchema.safeParse(cal()).success).toBe(true);
    const c = cal(); c.sequences[0].audienceIds = [];
    expect(CalendarSchema.safeParse(c).success).toBe(false);
    const d = cal(); (d.sequences[0].productLineIds as string[]) = ['PL9'];
    expect(CalendarSchema.safeParse(d).success).toBe(false);
  });
  it('requires assumptions', () => {
    expect(CalendarSchema.safeParse({ ...cal(), assumptions: [] }).success).toBe(false);
  });
});

describe('schemas', () => {
  it('insights need 5-8 entries', () => {
    expect(ModelInsightsSchema.safeParse({ trendSummary: 't', customerSummary: 'c', insights: [] }).success).toBe(false);
  });
  it('produce object-rooted JSON schemas', () => {
    expect((toolJsonSchema(ModelSequenceSchema) as any).type).toBe('object');
    expect((toolJsonSchema(CalendarSchema) as any).properties.sequences).toBeDefined();
  });
});
