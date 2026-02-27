import { createPolarClient } from '@tuturuuu/payment/polar/server';
import { createClient } from '@tuturuuu/supabase/next/server';
import { getCurrentSupabaseUser } from '@tuturuuu/utils/user-helper';
import { type NextRequest, NextResponse } from 'next/server';
import { PORT } from '@/constants/common';

export async function POST(request: NextRequest) {
  const baseUrl =
    process.env.NODE_ENV === 'development'
      ? `http://localhost:${PORT}`
      : 'https://tuturuuu.com';

  const { wsId, creditPackId } = await request.json();

  if (!wsId || !creditPackId) {
    return NextResponse.json(
      { error: 'Workspace ID and credit pack ID are required' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const user = await getCurrentSupabaseUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: hasPermission, error: permissionError } = await supabase.rpc(
    'has_workspace_permission',
    {
      p_user_id: user.id,
      p_ws_id: wsId,
      p_permission: 'manage_subscription',
    }
  );

  if (permissionError) {
    return NextResponse.json(
      { error: permissionError.message },
      { status: 500 }
    );
  }

  if (!hasPermission) {
    return NextResponse.json(
      { error: 'Unauthorized: missing billing permission' },
      { status: 403 }
    );
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id')
    .eq('id', wsId)
    .maybeSingle();

  if (workspaceError) {
    return NextResponse.json(
      { error: workspaceError.message },
      { status: 500 }
    );
  }

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const { data: creditPack, error: packError } = await supabase
    .from('workspace_credit_packs')
    .select('id, archived')
    .eq('id', creditPackId)
    .maybeSingle();

  if (packError) {
    return NextResponse.json({ error: packError.message }, { status: 500 });
  }

  if (!creditPack || creditPack.archived) {
    return NextResponse.json(
      { error: 'Credit pack is unavailable' },
      { status: 404 }
    );
  }

  try {
    const polar = createPolarClient();
    const checkoutSession = await polar.checkouts.create({
      metadata: {
        wsId,
      },
      products: [creditPackId],
      requireBillingAddress: true,
      embedOrigin: baseUrl,
      successUrl: `${baseUrl}/${wsId}/billing/success?checkoutId={CHECKOUT_ID}`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Failed to create credit pack checkout:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
