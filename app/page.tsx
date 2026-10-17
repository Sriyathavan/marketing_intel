import PlanApp from '../components/PlanApp';
import { mockContext, mockOpportunities, mockSegments } from '../components/__mocks__/mockData';
import type { ContextFile, Opportunity, SegmentProfile } from '../lib/types';

/* ============================================================
 * MOCK vs REAL SWITCH (the only place). Set USE_MOCK = false once
 * Package A (lib/opportunities, lib/segments, lib/data) and
 * Package B (/api/plan, lib/export) have landed.
 * ============================================================ */
const USE_MOCK = false;

async function loadData(): Promise<{ opportunities: Opportunity[]; segments: SegmentProfile[]; context: ContextFile }> {
  if (USE_MOCK) return { opportunities: mockOpportunities, segments: mockSegments, context: mockContext };
  const { buildOpportunities } = await import('../lib/opportunities');
  const { buildSegmentProfiles } = await import('../lib/segments');
  const { loadCustomers, loadContext } = await import('../lib/data');
  return { opportunities: buildOpportunities(), segments: buildSegmentProfiles(loadCustomers()), context: loadContext() };
}

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { opportunities, segments, context } = await loadData();
  return <PlanApp opportunities={opportunities} segments={segments} context={context} useMock={USE_MOCK} />;
}
