import { z } from 'zod';

export const OFFER_TYPES = ['content_story', 'early_access', 'promo_discount', 'new_trip_launch', 'bundle'] as const;

export const ModelEmailSchema = z.object({
  step: z.number().int().min(1).max(6),
  sendDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sendTimeLocal: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  subject: z.string().min(1).max(70),
  preheader: z.string().min(1).max(110),
  creativeDirection: z.string().min(1),
  cta: z.object({ label: z.string().min(1), target: z.string().min(1) }),
  offerType: z.enum(OFFER_TYPES),
  rationale: z.string().min(1),
  evidenceIds: z.array(z.string()).min(1),
});

export const ModelSequenceSchema = z.object({
  opportunityId: z.string().min(1),
  name: z.string().min(1),
  goal: z.string().min(1),
  cadence: z.object({ emailsPerWeek: z.number().min(0), spacingDays: z.number().min(0) }),
  rationale: z.string().min(1),
  evidenceIds: z.array(z.string()),
  emails: z.array(ModelEmailSchema).min(4).max(6),
});

export const ModelPlanSchema = z.object({
  sequences: z.array(ModelSequenceSchema).min(1),
});

export type ModelPlan = z.infer<typeof ModelPlanSchema>;
export type ModelSequence = z.infer<typeof ModelSequenceSchema>;
export type ModelEmail = z.infer<typeof ModelEmailSchema>;

/** JSON schema for the forced `submit_plan` tool (object root). */
export function planJsonSchema(): Record<string, unknown> {
  const s = z.toJSONSchema(ModelPlanSchema) as Record<string, unknown>;
  delete s.$schema;
  return s;
}

export function formatZodError(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
}
