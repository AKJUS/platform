import { createClient } from '@tuturuuu/supabase/next/server';
import { NextResponse } from 'next/server';
import { calculateInvoiceValues } from '../route';

interface Params {
  params: Promise<{
    wsId: string;
  }>;
}

interface InvoiceProduct {
  product_id: string;
  unit_id: string;
  warehouse_id: string;
  quantity: number;
  price: number;
  category_id: string;
}

interface CreateSubscriptionInvoiceRequest {
  customer_id: string;
  group_id: string;
  selected_month: string; // YYYY-MM
  content: string;
  notes?: string;
  wallet_id: string;
  promotion_id?: string;
  products: InvoiceProduct[];
  category_id: string;
  frontend_subtotal?: number;
  frontend_discount_amount?: number;
  frontend_total?: number;
}

export async function POST(req: Request, { params }: Params) {
  const supabase = await createClient();
  const { wsId } = await params;

  try {
    const {
      customer_id,
      group_id,
      selected_month,
      content,
      notes,
      wallet_id,
      promotion_id,
      products,
      category_id,
      frontend_subtotal,
      frontend_discount_amount,
      frontend_total,
    }: CreateSubscriptionInvoiceRequest = await req.json();

    if (
      !customer_id ||
      !group_id ||
      !selected_month ||
      !products ||
      products.length === 0 ||
      !wallet_id ||
      !category_id
    ) {
      return NextResponse.json(
        {
          message:
            'Missing required fields: customer_id, group_id, selected_month, products, wallet_id, and category_id',
        },
        { status: 400 }
      );
    }

    // Calculate values using backend logic (shared)
    const calculatedValues = await calculateInvoiceValues(
      supabase,
      wsId,
      products,
      promotion_id,
      {
        subtotal: frontend_subtotal,
        discount_amount: frontend_discount_amount,
        total: frontend_total,
      }
    );

    const {
      subtotal,
      discount_amount,
      total,
      values_recalculated,
      rounding_applied,
    } = calculatedValues;

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Map platform user to workspace virtual user
    let workspaceUserId: string | null = null;
    if (user) {
      const { data: workspaceUser } = await supabase
        .from('workspace_user_linked_users')
        .select('virtual_user_id ')
        .eq('platform_user_id', user.id)
        .eq('ws_id', wsId)
        .single();

      workspaceUserId = workspaceUser?.virtual_user_id || null;
    }

    // Compute valid_until as the first day of the next month after selected_month
    const startOfMonth = new Date(`${selected_month}-01T00:00:00.000Z`);
    const validUntil = new Date(startOfMonth);
    validUntil.setMonth(validUntil.getMonth() + 1);

    const invoiceData: any = {
      ws_id: wsId,
      customer_id,
      user_group_id: group_id,
      price: Math.round(total - rounding_applied),
      total_diff: Math.round(rounding_applied),
      note: notes,
      notice: content,
      wallet_id,
      category_id,
      completed_at: new Date().toISOString(),
      valid_until: validUntil.toISOString(),
      paid_amount: Math.round(total),
    };

    if (workspaceUserId) {
      invoiceData.creator_id = workspaceUserId;
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from('finance_invoices')
      .insert(invoiceData)
      .select('id')
      .single();

    if (invoiceError) {
      console.error('Error creating subscription invoice:', invoiceError);
      return NextResponse.json(
        {
          message: 'Error creating subscription invoice',
          details: invoiceError.message,
        },
        { status: 500 }
      );
    }

    const invoiceId = invoice.id;

    // Deduplicate products
    const productMap = new Map<string, InvoiceProduct>();
    products.forEach((product) => {
      const key = `${product.product_id}-${product.unit_id}-${product.warehouse_id}-${product.price}`;
      if (productMap.has(key)) {
        const existing = productMap.get(key);
        if (existing) existing.quantity += product.quantity;
      } else {
        productMap.set(key, { ...product });
      }
    });

    const productValues = Array.from(productMap.values());

    // Fetch product and unit names
    const { data: productsData, error: productsError } = await supabase
      .from('workspace_products')
      .select('name, id')
      .in(
        'id',
        productValues.map((product) => product.product_id)
      )
      .eq('ws_id', wsId);

    if (productsError) {
      console.error('Error getting products information:', productsError);
      return NextResponse.json(
        {
          message: 'Error getting products information',
          details: productsError.message,
        },
        { status: 500 }
      );
    }

    const unitIds = productValues.map((product) => product.unit_id);
    const { data: unitsData, error: unitsError } = await supabase
      .from('inventory_units')
      .select('name, id')
      .in('id', unitIds)
      .eq('ws_id', wsId);

    if (unitsError) {
      console.error('Error getting units information:', unitsError);
      return NextResponse.json(
        {
          message: 'Error getting units information',
          details: unitsError.message,
        },
        { status: 500 }
      );
    }

    const invoiceProducts = productValues.map((product) => ({
      invoice_id: invoiceId,
      product_name:
        productsData.find((p) => p.id === product.product_id)?.name || '',
      product_unit:
        unitsData.find((unit) => unit.id === product.unit_id)?.name || '',
      product_id: product.product_id,
      unit_id: product.unit_id,
      warehouse_id: product.warehouse_id,
      amount: product.quantity,
      price: Math.round(product.price),
    }));

    const { error: invoiceProductsError } = await supabase
      .from('finance_invoice_products')
      .insert(invoiceProducts);

    if (invoiceProductsError) {
      console.error(
        'Error creating subscription invoice products:',
        invoiceProductsError
      );
      await Promise.all([
        supabase.from('finance_invoices').delete().eq('id', invoiceId),
      ]);
      return NextResponse.json(
        {
          message: 'Error creating invoice products',
          details: invoiceProductsError.message,
        },
        { status: 500 }
      );
    }

    // Promotion linkage
    if (promotion_id && promotion_id !== 'none' && discount_amount > 0) {
      const { data: promotion, error: promotionFetchError } = await supabase
        .from('workspace_promotions')
        .select('use_ratio, value, name, code, description')
        .eq('id', promotion_id)
        .single();

      if (!promotionFetchError || promotion) {
        const { error: promotionError } = await supabase
          .from('finance_invoice_promotions')
          .insert({
            invoice_id: invoiceId,
            promo_id: promotion_id,
            value: promotion?.value || discount_amount,
            use_ratio: promotion?.use_ratio || true,
            name: promotion?.name || '',
            code: promotion?.code || '',
            description: promotion?.description || '',
          });

        if (promotionError) {
          console.error('Error creating invoice promotion:', promotionError);
          await Promise.all([
            supabase
              .from('finance_invoice_products')
              .delete()
              .eq('invoice_id', invoiceId),
            supabase.from('finance_invoices').delete().eq('id', invoiceId),
          ]);
          return NextResponse.json(
            {
              message: 'Error applying promotion to invoice',
              details: promotionError.message,
            },
            { status: 500 }
          );
        }
      }
    }

    // Stock changes (sell)
    const stockChanges = productValues.map((product) => ({
      product_id: product.product_id,
      unit_id: product.unit_id,
      warehouse_id: product.warehouse_id,
      amount: -product.quantity,
      creator_id: workspaceUserId || '',
      beneficiary_id: customer_id,
    }));

    const { error: stockError } = await supabase
      .from('product_stock_changes')
      .insert(stockChanges);

    if (stockError) {
      console.error('Error creating stock changes:', stockError);
      await Promise.all([
        supabase
          .from('finance_invoice_promotions')
          .delete()
          .eq('invoice_id', invoiceId),
        supabase
          .from('finance_invoice_products')
          .delete()
          .eq('invoice_id', invoiceId),
        supabase.from('finance_invoices').delete().eq('id', invoiceId),
      ]);
      return NextResponse.json(
        {
          message: 'Error updating product stock',
          details: stockError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Subscription invoice created successfully',
      invoice_id: invoiceId,
      data: {
        id: invoiceId,
        customer_id,
        group_id,
        selected_month,
        total,
        subtotal,
        discount_amount,
        products_count: products.length,
        values_recalculated,
        calculated_values: {
          subtotal,
          discount_amount,
          total,
          rounding_applied,
        },
        ...(values_recalculated &&
        frontend_subtotal &&
        frontend_discount_amount &&
        frontend_total
          ? {
              frontend_values: {
                subtotal: frontend_subtotal,
                discount_amount: frontend_discount_amount,
                total: frontend_total,
              },
            }
          : {}),
      },
    });
  } catch (error) {
    console.error('Unexpected error creating subscription invoice:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
