import {PendingTrailReport} from '@/src/components/trail-maintenance/PendingTrailReport';
export default async function PendingReportPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  return <PendingTrailReport id={id} />;
}
