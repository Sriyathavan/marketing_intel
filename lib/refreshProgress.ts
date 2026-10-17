import type { RefreshEvent } from './types';

export type StageStatus = 'pending' | 'running' | 'done';
export interface RefreshState {
  phase: 'idle' | 'running' | 'done' | 'error';
  data: StageStatus; analyst: StageStatus; planner: StageStatus;
  keywords: string[]; insights?: number; sequences?: number;
  error?: string;
}
export const idleRefresh: RefreshState = { phase: 'idle', data: 'pending', analyst: 'pending', planner: 'pending', keywords: [] };
export const startRefresh: RefreshState = { ...idleRefresh, phase: 'running' };

export function applyRefreshEvent(s: RefreshState, ev: RefreshEvent): RefreshState {
  switch (ev.stage) {
    case 'data': return { ...s, data: ev.status === 'start' ? 'running' : 'done', keywords: ev.keywords ?? s.keywords };
    case 'analyst': return { ...s, data: 'done', analyst: ev.status === 'start' ? 'running' : 'done', insights: ev.insights ?? s.insights };
    case 'planner': return { ...s, data: 'done', analyst: 'done', planner: ev.status === 'start' ? 'running' : 'done', sequences: ev.sequences ?? s.sequences };
    case 'done': return { ...s, phase: 'done', data: 'done', analyst: 'done', planner: 'done' };
    case 'error': return { ...s, phase: 'error', error: ev.message };
  }
}

/** Splits an NDJSON buffer into complete parsed events plus the unfinished remainder. Malformed lines are skipped. */
export function parseNdjson(buffer: string): { events: RefreshEvent[]; rest: string } {
  const lines = buffer.split('\n');
  const rest = lines.pop() ?? '';
  const events: RefreshEvent[] = [];
  for (const l of lines) {
    if (!l.trim()) continue;
    try { const o = JSON.parse(l); if (o && typeof o.stage === 'string') events.push(o as RefreshEvent); } catch { /* skip */ }
  }
  return { events, rest };
}
