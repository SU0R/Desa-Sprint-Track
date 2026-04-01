import { SessionDetailPage } from '@/features/sessions/session-detail-page';

export default async function SessionRoute({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <SessionDetailPage sessionId={id} />;
}
