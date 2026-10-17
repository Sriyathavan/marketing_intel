import { describe, it, expect } from 'vitest';
import { ModelPlanSchema, planJsonSchema } from '@/lib/planSchema';
import { opp, modelPlanFor } from './_planFixtures';

const plan = () => modelPlanFor([opp(1)]);

describe('ModelPlanSchema', () => {
  it('accepts a valid plan', () => {
    expect(ModelPlanSchema.safeParse(plan()).success).toBe(true);
  });
  it('rejects subject over 70 chars', () => {
    const p = plan(); p.sequences[0].emails[0].subject = 'x'.repeat(71);
    expect(ModelPlanSchema.safeParse(p).success).toBe(false);
  });
  it('rejects preheader over 110 chars', () => {
    const p = plan(); p.sequences[0].emails[0].preheader = 'x'.repeat(111);
    expect(ModelPlanSchema.safeParse(p).success).toBe(false);
  });
  it('rejects fewer than 4 or more than 6 emails', () => {
    const p = plan(); p.sequences[0].emails.pop();
    expect(ModelPlanSchema.safeParse(p).success).toBe(false);
    const q = modelPlanFor([opp(1)], Array(7).fill('2026-11-03'));
    expect(ModelPlanSchema.safeParse(q).success).toBe(false);
  });
  it('requires at least one evidence id and valid enums', () => {
    const p = plan(); p.sequences[0].emails[0].evidenceIds = [];
    expect(ModelPlanSchema.safeParse(p).success).toBe(false);
    const q = plan(); (q.sequences[0].emails[0] as any).offerType = 'nope';
    expect(ModelPlanSchema.safeParse(q).success).toBe(false);
  });
  it('rejects bad date/time formats', () => {
    const p = plan(); p.sequences[0].emails[0].sendDate = '11/03/2026';
    expect(ModelPlanSchema.safeParse(p).success).toBe(false);
    const q = plan(); q.sequences[0].emails[0].sendTimeLocal = '7am';
    expect(ModelPlanSchema.safeParse(q).success).toBe(false);
  });
  it('produces an object-rooted JSON schema', () => {
    const s = planJsonSchema() as any;
    expect(s.type).toBe('object');
    expect(s.properties.sequences).toBeDefined();
  });
});
