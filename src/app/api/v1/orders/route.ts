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
  const { supabase, user } = await createApiSupabaseClient(request);

  if (!user) {
    return jsonResponse({ error: "Debes iniciar sesión." }, { status: 401, request });
  }

  if (orderId) {
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("id", orderId)
      .maybeSingle();

    if (error || !data) {
      return jsonResponse({ error: "Orden no encontrada." }, { status: 404, request });
    }
    return jsonResponse({ order: data }, { request });
  }

  const [{ data: purchases, error: pErr }, { data: sales, error: sErr }] =
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
    ]);

  if (pErr || sErr) {
    return jsonResponse({ error: "Error cargando tus órdenes." }, { status: 500, request });
  }

  return jsonResponse(
    {
      purchases: purchases ?? [],
      sales: sales ?? [],
    },
    { request }
  );
}
