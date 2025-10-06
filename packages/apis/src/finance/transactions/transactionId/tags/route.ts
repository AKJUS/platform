import { createClient } from '@tuturuuu/supabase/next/server';
import { NextResponse } from 'next/server';

interface Params {
  params: Promise<{
    transactionId: string;
  }>;
}

export async function GET(_: Request, { params }: Params) {
  const supabase = await createClient();
  const { transactionId } = await params;

  const { data, error } = await supabase
    .from('wallet_transaction_tags')
    .select('tag_id')
    .eq('transaction_id', transactionId);

  if (error) {
    console.log(error);
    return NextResponse.json(
      { message: 'Error fetching transaction tags' },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
