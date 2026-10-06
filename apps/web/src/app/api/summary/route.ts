import { nationalSummary } from '@/server/repository';
import { json } from '@/lib/api';

export async function GET() {
  return json(await nationalSummary(), 300);
}
