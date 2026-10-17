import PlanApp from '../components/PlanApp';
import { buildOpportunities } from '../lib/opportunities';
import { buildSegmentProfiles } from '../lib/segments';
import { loadCustomers, loadContext } from '../lib/data';

export const dynamic = 'force-dynamic';

export default function Page() {
  return <PlanApp opportunities={buildOpportunities()} segments={buildSegmentProfiles(loadCustomers())} context={loadContext()} />;
}
