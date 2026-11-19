import {
  createApiSupabaseClient,
  handleCorsOptions,
  jsonResponse,
} from "@/lib/supabase/api-auth";

const ORDER_SELECT = `
  *,
  listing:listings!orders_listing_id_fkey(id, title, brand, images, size, meetup_zone),
  buyer:profiles!orders_buyer_id_fkey(*),
  seller:profiles!orders_seller_id_fkey(*)
`;

export async function OPTIONS(request: Request) {
  return handleCorsOptions(request);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("id");
  const listingId = searchParams.get("listingId");
  const { supabase, user } = await createApiSupabaseClient(request);

  if (!user) {
    return jsonResponse({ error: "Debes iniciar sesión." }, { status: 401, request });
  }

  if (orderId) {
    const [{ data, error }, { data: handoverRow }, { data: returnRow }] =
      await Promise.all([
        supabase
          .from("orders")
          .select(ORDER_SELECT)
          .eq("id", orderId)
          .maybeSingle(),
        supabase
          .from("order_handover_codes")
          .select("code")
          .eq("order_id", orderId)
          .maybeSingle(),
        supabase
          .from("order_return_codes")
          .select("code")
          .eq("order_id", orderId)
          .maybeSingle(),
      ]);

    if (error || !data) {
      return jsonResponse({ error: "Orden no encontrada." }, { status: 404, request });
    }
    return jsonResponse(
      {
        order: {
          ...data,
          handover_code: handoverRow?.code ?? null,
          return_code: returnRow?.code ?? null,
        },
      },
      { request }
    );
  }

  if (listingId) {
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("listing_id", listingId)
      .neq("status", "cancelled")
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return jsonResponse({ error: "Error consultando orden." }, { status: 500, request });
    }

    if (!data) {
      return jsonResponse({ order: null }, { request });
    }

    const [{ data: handoverRow }, { data: returnRow }] = await Promise.all([
      supabase
        .from("order_handover_codes")
        .select("code")
        .eq("order_id", data.id)
        .maybeSingle(),
      supabase
        .from("order_return_codes")
        .select("code")
        .eq("order_id", data.id)
        .maybeSingle(),
    ]);

    return jsonResponse(
      {
        order: {
          ...data,
          handover_code: handoverRow?.code ?? null,
          return_code: returnRow?.code ?? null,
        },
      },
      { request }
    );
  }

  const [{ data: purchases, error: pErr }, { data: sales, error: sErr }, { data: handoverRows }, { data: returnRows }] =
    await Promise.all([
      supabase
        .from("orders")
        .select(ORDER_SELECT)
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select(ORDER_SELECT)
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("order_handover_codes").select("order_id, code"),
      supabase.from("order_return_codes").select("order_id, code"),
    ]);

  if (pErr || sErr) {
    return jsonResponse({ error: "Error cargando tus órdenes." }, { status: 500, request });
  }

  const handoverMap = new Map(
    (handoverRows ?? []).map((row) => [row.order_id, row.code])
  );
  const returnMap = new Map(
    (returnRows ?? []).map((row) => [row.order_id, row.code])
  );

  return jsonResponse(
    {
      purchases: (purchases ?? []).map((order) => ({
        ...order,
        handover_code: handoverMap.get(order.id) ?? null,
      })),
      sales: (sales ?? []).map((order) => ({
        ...order,
        return_code: returnMap.get(order.id) ?? null,
      })),
    },
    { request }
  );
}
