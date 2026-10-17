import type { ContextFile, Opportunity, SegmentProfile } from './types';

export const SYSTEM_PROMPT = `You are a senior lifecycle email marketer for an adventure-travel company. Plan a 90-day email program from the structured opportunities you are given.

Rules:
- Call the submit_plan tool exactly once. Produce exactly one sequence per opportunity, each with 4 to 6 emails.
- Send dates must be ISO YYYY-MM-DD within planStart..planEnd, never on a sendBlackout date, and respect each segment's fatigueCapPerWeek (emails per week across that segment). Use the segment's modalSendDay/modalSendHour for send timing where sensible. Align emails with holidays and launches provided.
- subject max 70 characters, preheader max 110 characters. Match the segment's dominantTone.
- Every email and sequence must cite evidenceIds taken ONLY from that opportunity's evidence list. Never invent ids.
- You only see aggregate data. Do not claim knowledge of individuals.
- NEVER reference or imply in any copy or rationale: life events, health, grief, bereavement, divorce, relationship status, weight, age, or gender. Do not target by gender. Sensitive signals are used for suppression only and are handled outside your output.
- Offer types per email must be one of: content_story, early_access, promo_discount, new_trip_launch, bundle. Do not exceed the claims supported by the evidence (no fabricated prices or discounts percentages unless provided).
- Keep creativeDirection concrete (visuals, layout, hook) and rationale short, tied to evidence.`;

export function buildPayload(opps: Opportunity[], profiles: SegmentProfile[], ctx: ContextFile) {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return {
    planStart: ctx.planStart,
    planEnd: ctx.planEnd,
    sendBlackouts: ctx.sendBlackouts,
    holidays: ctx.holidays.map((h) => ({ id: h.id, name: h.name, date: h.date, demandBoost: h.demandBoost })),
    launches: ctx.launches,
    opportunities: opps.map((o) => {
      const p = byId.get(o.segmentId);
      return {
        opportunityId: o.id,
        title: o.title,
        thesis: o.thesis,
        interest: o.interest,
        offerType: o.offerType,
        windowStart: o.windowStart,
        windowEnd: o.windowEnd,
        reachable: o.reachable,
        scoreTotal: o.score.total,
        segment: p && {
          id: p.id, name: p.name, definition: p.definition, eligible: p.eligible,
          fatigueCapPerWeek: p.fatigueCapPerWeek, modalSendDay: p.modalSendDay,
          modalSendHour: p.modalSendHour, dominantTone: p.dominantTone,
          topInterests: p.topInterests, suppressedSensitive: p.suppressedSensitive,
        },
        evidence: o.evidence.map((e) => ({ id: e.id, label: e.label, value: e.value, unit: e.unit })),
      };
    }),
  };
}

export function buildUserMessage(opps: Opportunity[], profiles: SegmentProfile[], ctx: ContextFile): string {
  return `Plan the program for these opportunities. Data (aggregates only):\n${JSON.stringify(buildPayload(opps, profiles, ctx))}`;
}
