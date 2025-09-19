import { MeetTogetherPage } from '@tuturuuu/ui/legacy/tumeet/page';
import { getWorkspace } from '@tuturuuu/utils/workspace-helper';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Plans',
  description: 'Manage Plans in the Tumeet area of your Tuturuuu workspace.',
};

interface TumeetPageProps {
  params: Promise<{
    wsId: string;
  }>;
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
  }>;
}

export default async function TumeetPage({
  params,
  searchParams,
}: TumeetPageProps) {
  const { wsId: id } = await params;
  const workspace = await getWorkspace(id);
  const wsId = workspace?.id;

  return (
    <div className="-m-4">
      <MeetTogetherPage wsId={wsId} searchParams={searchParams} />
    </div>
  );
}
