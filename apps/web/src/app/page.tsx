import { Finder } from '@/components/finder/Finder';
import { nationalSummary } from '@/server/repository';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const summary = await nationalSummary().catch(() => null);
  return <Finder summary={summary && { meta: summary.meta, stations: summary.stations, national: summary.national }} />;
}
