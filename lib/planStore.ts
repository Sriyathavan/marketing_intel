import type { CampaignPlan, EmailCampaign, ReviewStatus } from './types';

export const STORAGE_KEY = 'mie.plan.v1';

export interface Selection { sequenceId: string; emailId?: string }
export interface PlanState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  plan?: CampaignPlan;
  selected?: Selection;
  error?: string;
}
export type EmailEdit = Partial<Pick<EmailCampaign,
  'subject' | 'preheader' | 'sendDate' | 'sendTimeLocal' | 'creativeDirection' | 'cta'>>;

export type PlanAction =
  | { type: 'loading' }
  | { type: 'error'; message: string }
  | { type: 'loaded'; plan: CampaignPlan }
  | { type: 'editEmail'; emailId: string; patch: EmailEdit }
  | { type: 'setStatus'; emailId: string; status: ReviewStatus }
  | { type: 'setSequenceStatus'; sequenceId: string; status: ReviewStatus }
  | { type: 'select'; selection?: Selection }
  | { type: 'reset' };

const SENSITIVE_RE = /divorce|widow|bereave|grief|passed away|diagnos|weight loss|recover(y|ing) from|fresh start after|single again|empty nest|your age/i;
/** Re-run the G4 copy check after a user edit; keeps non-copy flags untouched. */
function recheckFlags(e: EmailCampaign): string[] {
  const kept = e.guardrailFlags.filter(f => !f.startsWith('copy_sensitive_term:'));
  const m = SENSITIVE_RE.exec([e.subject, e.preheader, e.creativeDirection, e.rationale].join('\n'));
  return m ? [...kept, `copy_sensitive_term:${m[0].toLowerCase()}`] : kept;
}

export const initialState: PlanState = { status: 'idle' };

/** Approval is refused while a guardrail flag is set. Reject/proposed always allowed. */
function nextStatus(e: EmailCampaign, status: ReviewStatus): ReviewStatus {
  return status === 'approved' && e.guardrailFlags.length > 0 ? e.status : status;
}

function mapEmails(plan: CampaignPlan, fn: (e: EmailCampaign) => EmailCampaign, seqId?: string): CampaignPlan {
  return {
    ...plan,
    sequences: plan.sequences.map(s =>
      seqId && s.id !== seqId ? s : { ...s, emails: s.emails.map(fn) }),
  };
}

function withFlags(e: EmailCampaign): EmailCampaign {
  const guardrailFlags = recheckFlags(e);
  return { ...e, guardrailFlags, status: guardrailFlags.length && e.status === 'approved' ? 'proposed' : e.status };
}

export function planReducer(state: PlanState, action: PlanAction): PlanState {
  switch (action.type) {
    case 'loading': return { ...state, status: 'loading', error: undefined };
    case 'error': return { ...state, status: state.plan ? 'ready' : 'error', error: action.message };
    case 'loaded': return { status: 'ready', plan: action.plan, selected: undefined };
    case 'select': return { ...state, selected: action.selection };
    case 'reset': return { status: 'idle' };
    case 'editEmail': {
      if (!state.plan) return state;
      const plan = mapEmails(state.plan, e => e.id === action.emailId
        ? withFlags({ ...e, ...action.patch, cta: { ...e.cta, ...action.patch.cta }, editedByUser: true }) : e);
      return { ...state, plan };
    }
    case 'setStatus': {
      if (!state.plan) return state;
      return { ...state, plan: mapEmails(state.plan, e =>
        e.id === action.emailId ? { ...e, status: nextStatus(e, action.status) } : e) };
    }
    case 'setSequenceStatus': {
      if (!state.plan) return state;
      return { ...state, plan: mapEmails(state.plan, e => ({ ...e, status: nextStatus(e, action.status) }), action.sequenceId) };
    }
    default: return state;
  }
}

export function allEmails(plan?: CampaignPlan): EmailCampaign[] {
  return plan ? plan.sequences.flatMap(s => s.emails) : [];
}
export function approvedCount(plan?: CampaignPlan): number {
  return allEmails(plan).filter(e => e.status === 'approved').length;
}

type StoreLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
function store(s?: StoreLike): StoreLike | null {
  try { return s ?? (typeof localStorage !== 'undefined' ? localStorage : null); } catch { return null; }
}
export function loadPersisted(s?: StoreLike): CampaignPlan | null {
  try {
    const raw = store(s)?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return p && Array.isArray(p.sequences) && typeof p.planStart === 'string' ? p as CampaignPlan : null;
  } catch { return null; }
}
export function savePersisted(plan: CampaignPlan | undefined, s?: StoreLike): void {
  try {
    const st = store(s);
    if (!st) return;
    if (plan) st.setItem(STORAGE_KEY, JSON.stringify(plan)); else st.removeItem(STORAGE_KEY);
  } catch { /* storage unavailable */ }
}
