import type { CampaignPlan, EmailCampaign, EmailSequence, Opportunity, SegmentProfile, ContextFile } from './types';
import type { ModelPlan } from './planSchema';

export const MODEL_ID = 'claude-sonnet-5-5';
export const SENSITIVE_COPY_REGEX =
  /divorce|widow|bereave|grief|passed away|diagnos|weight loss|recover(?:y|ing) from|fresh start after|single again|empty nest|your age/i;

const DAY = 86400000;
const toMs = (d: string) => Date.parse(d + 'T00:00:00Z');
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => fromMs(toMs(d) + n * DAY);
/** Monday of the week containing d. */
export function weekStart(d: string): string {
  const dow = new Date(toMs(d)).getUTCDay(); // 0=Sun
  return addDays(d, -((dow + 6) % 7));
}

export function checkCopy(e: { subject: string; preheader: string; creativeDirection: string; rationale: string }): string[] {
  const flags: string[] = [];
  const g = new RegExp(SENSITIVE_COPY_REGEX.source, 'gi');
  for (const field of [e.subject, e.preheader, e.creativeDirection, e.rationale]) {
    for (const m of field.matchAll(g)) {
      const f = `copy_sensitive_term:${m[0].toLowerCase()}`;
      if (!flags.includes(f)) flags.push(f);
    }
  }
  return flags;
}

export function suppressionNote(p: Pick<SegmentProfile, 'size' | 'suppressedSensitive'>): string {
  const pct = p.size > 0 ? Math.round((p.suppressedSensitive / p.size) * 100) : 0;
  return `${p.suppressedSensitive} of ${p.size} segment members (${pct}%) excluded for sensitive life events; used for suppression only`;
}

export interface GuardrailInput {
  opportunities: Opportunity[]; // the requested ones
  profiles: SegmentProfile[];
  context: Pick<ContextFile, 'planStart' | 'planEnd' | 'sendBlackouts'>;
  now?: Date;
}

export function postProcess(model: ModelPlan, input: GuardrailInput): CampaignPlan {
  const { context, profiles } = input;
  const { planStart, planEnd } = context;
  const blackouts = new Set(context.sendBlackouts);
  const oppById = new Map(input.opportunities.map((o) => [o.id, o]));
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const warnings: string[] = [];

  const clampDate = (d: string) => (d < planStart ? planStart : d > planEnd ? planEnd : d);
  const offBlackout = (d: string): string => {
    let x = d;
    while (blackouts.has(x) && x < planEnd) x = addDays(x, 1);
    while (blackouts.has(x) && x > planStart) x = addDays(x, -1);
    return x;
  };

  const sequences: EmailSequence[] = [];
  for (const ms of model.sequences) {
    const opp = oppById.get(ms.opportunityId);
    if (!opp) {
      warnings.push(`Dropped sequence for unknown opportunity ${ms.opportunityId}`);
      continue;
    }
    const known = new Set(opp.evidence.map((e) => e.id));
    const fallback = opp.evidence.slice(0, 2).map((e) => e.id);
    const cleanIds = (ids: string[], where: string): string[] => {
      const kept = ids.filter((i) => known.has(i));
      if (kept.length < ids.length) warnings.push(`${where}: removed ${ids.length - kept.length} unknown evidence id(s)`);
      return kept;
    };
    const seqId = `seq_${opp.id}`;
    let seqEvidence = cleanIds(ms.evidenceIds, `${seqId}`);
    if (seqEvidence.length === 0) seqEvidence = fallback;

    const emails: EmailCampaign[] = ms.emails.map((me, i) => {
      let ev = cleanIds(me.evidenceIds, `${seqId} step ${me.step}`);
      if (ev.length === 0) {
        ev = fallback;
        warnings.push(`${seqId} step ${me.step}: no valid evidence, fell back to top evidence`);
      }
      const flags = checkCopy(me);
      let sendDate = clampDate(me.sendDate);
      if (sendDate !== me.sendDate) warnings.push(`${seqId} step ${me.step}: sendDate ${me.sendDate} clamped to ${sendDate}`);
      const nb = offBlackout(sendDate);
      if (nb !== sendDate) warnings.push(`${seqId} step ${me.step}: sendDate ${sendDate} is a blackout, moved to ${nb}`);
      sendDate = nb;
      return {
        id: '', sequenceId: seqId, opportunityId: opp.id, segmentId: opp.segmentId,
        step: me.step, sendDate, sendTimeLocal: me.sendTimeLocal,
        subject: me.subject, preheader: me.preheader, creativeDirection: me.creativeDirection,
        cta: { ...me.cta }, offerType: me.offerType, rationale: me.rationale, evidenceIds: ev,
        status: 'proposed', editedByUser: false, guardrailFlags: flags,
      } satisfies EmailCampaign;
    });

    const profile = profileById.get(opp.segmentId);
    sequences.push({
      id: seqId, opportunityId: opp.id, segmentId: opp.segmentId,
      name: ms.name, goal: ms.goal, cadence: ms.cadence, rationale: ms.rationale,
      evidenceIds: seqEvidence,
      suppressionNote: profile ? suppressionNote(profile) : 'Sensitive life events are used for suppression only',
      emails,
    });
  }

  // Weekly cap per segment (shared across that segment's sequences).
  const capFor = (segId: string) => {
    if (segId === 'seg_lapsed') return 1;
    return profileById.get(segId as never)?.fatigueCapPerWeek ?? 3;
  };
  const bySeg = new Map<string, EmailCampaign[]>();
  for (const s of sequences) for (const e of s.emails) (bySeg.get(e.segmentId) ?? bySeg.set(e.segmentId, []).get(e.segmentId)!).push(e);
  for (const [segId, list] of bySeg) {
    const cap = capFor(segId);
    list.sort((a, b) => a.sendDate.localeCompare(b.sendDate) || a.sequenceId.localeCompare(b.sequenceId) || a.step - b.step);
    const counts = new Map<string, number>();
    for (const e of list) {
      let d = e.sendDate;
      const orig = d;
      let guard = 0;
      while ((counts.get(weekStart(d)) ?? 0) >= cap && guard++ < 30) {
        d = offBlackout(clampDate(addDays(d, 1)));
        if (d >= planEnd) break;
      }
      if ((counts.get(weekStart(d)) ?? 0) >= cap) {
        // try earlier days instead
        let back = orig;
        guard = 0;
        while ((counts.get(weekStart(back)) ?? 0) >= cap && back > planStart && guard++ < 120) back = offBlackout(addDays(back, -1));
        if ((counts.get(weekStart(back)) ?? 0) < cap) d = back;
        else {
          e.guardrailFlags.push('weekly_cap_exceeded');
          warnings.push(`${e.sequenceId} step ${e.step}: could not satisfy weekly cap of ${cap} for ${segId}`);
        }
      }
      if (d !== orig) {
        e.sendDate = d;
        warnings.push(`${e.sequenceId} step ${e.step}: moved ${orig} to ${d} for weekly cap of ${cap} for ${segId}`);
      }
      counts.set(weekStart(e.sendDate), (counts.get(weekStart(e.sendDate)) ?? 0) + 1);
    }
  }

  // Order, renumber, assign ids.
  for (const s of sequences) {
    s.emails.sort((a, b) => a.sendDate.localeCompare(b.sendDate) || a.step - b.step);
    s.emails.forEach((e, i) => { e.step = i + 1; e.id = `em_${s.id}_${e.step}`; });
  }
  for (const s of sequences) for (const e of s.emails) {
    if (e.guardrailFlags.length) warnings.push(`${e.id}: flagged ${e.guardrailFlags.join(', ')}`);
  }

  return {
    planStart, planEnd, generatedAt: (input.now ?? new Date()).toISOString(),
    source: 'claude', model: MODEL_ID, warnings, sequences,
  };
}
