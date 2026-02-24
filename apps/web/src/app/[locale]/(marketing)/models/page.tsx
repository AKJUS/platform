import { createAdminClient } from '@tuturuuu/supabase/next/server';
import { getTranslations } from 'next-intl/server';
import ModelsClient from './models-client';

export async function generateMetadata() {
  const t = await getTranslations('marketing-models');

  return {
    title: t('title'),
    description: t('subtitle'),
  };
}

export default async function ModelsPage() {
  const sbAdmin = await createAdminClient();

  const { data: models, error } = await sbAdmin
    .from('ai_gateway_models')
    .select('*')
    .order('provider')
    .order('name');

  if (error) {
    console.error('Failed to fetch models for public page', error);
  }

  return <ModelsClient initialModels={models ?? []} />;
}
