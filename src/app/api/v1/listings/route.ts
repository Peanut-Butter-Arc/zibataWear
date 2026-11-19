import { createListingSchema } from "@/core/schemas/validation";
import { recommendClothingPricing } from "@/core/pricing/engine";
import {
  createApiSupabaseClient,
  ensureUserProfile,
  handleCorsOptions,
  jsonResponse,
} from "@/lib/supabase/api-auth";

export async function OPTIONS(request: Request) {
  return handleCorsOptions(request);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const category = searchParams.get("category")?.trim() ?? "";
  const mode = searchParams.get("mode")?.trim() ?? "all";
  const size = searchParams.get("size")?.trim() ?? "";
  const zone = searchParams.get("zone")?.trim() ?? "";
  const sort = searchParams.get("sort")?.trim() ?? "recent";
  const mine = searchParams.get("mine") === "true";

  const { supabase, user } = await createApiSupabaseClient(request);

  if (mine && !user) {
    return jsonResponse({ error: "Debes iniciar sesión." }, { status: 401, request });
  }

  let query = supabase
    .from("listings")
    .select("*, seller:profiles!listings_seller_id_fkey(*)");

  if (mine && user) {
    query = query.eq("seller_id", user.id);
  } else {
    query = query.eq("status", "active");
  }

  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  if (mode === "buy") {
    query = query.in("listing_mode", ["buy", "both"]);
  } else if (mode === "rent") {
    query = query.in("listing_mode", ["rent", "both"]);
  }

  if (size && size !== "all") {
    query = query.eq("size", size);
  }

  if (zone && zone !== "all") {
    query = query.eq("meetup_zone", zone);
  }

  if (q) {
    const safeQ = q.replace(/[,()%]/g, " ").trim();
    if (safeQ) {
      query = query.or(
        `title.ilike.%${safeQ}%,brand.ilike.%${safeQ}%,description.ilike.%${safeQ}%`
      );
    }
  }

  if (sort === "price_asc") {
    query = query.order("sale_price_mxn", { ascending: true, nullsFirst: false });
  } else if (sort === "price_desc") {
    query = query.order("sale_price_mxn", { ascending: false, nullsFirst: false });
  } else {
    query = query
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false });
  }

  const { data, error } = await query.limit(60);

  if (error) {
    return jsonResponse(
      { error: "No pudimos cargar las prendas.", details: error.message },
      { status: 500, request }
    );
  }

  return jsonResponse({ listings: data ?? [] }, { request });
}

export async function POST(request: Request) {
  const { supabase, user } = await createApiSupabaseClient(request);
  if (!user) {
    return jsonResponse({ error: "Inicia sesión para publicar tu prenda." }, { status: 401, request });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Cuerpo JSON inválido." }, { status: 400, request });
  }

  const parsed = createListingSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      { error: parsed.error.issues[0]?.message ?? "Revisa los campos de la prenda." },
      { status: 400, request }
    );
  }

  await ensureUserProfile(supabase, user);

  const payload = parsed.data;
  const rec = recommendClothingPricing({
    category: payload.category,
    brand: payload.brand,
    condition: payload.condition,
    size: payload.size,
    originalPriceMxn: payload.original_price_mxn ?? undefined,
    meetupZone: payload.meetup_zone,
    listingMode: payload.listing_mode,
  });

  const { data, error } = await supabase
    .from("listings")
    .insert({
      seller_id: user.id,
      title: payload.title,
      description: payload.description,
      brand: payload.brand,
      category: payload.category,
      size: payload.size,
      condition: payload.condition,
      listing_mode: payload.listing_mode,
      sale_price_mxn: payload.listing_mode === "rent" ? null : payload.sale_price_mxn ?? null,
      rent_price_per_day_mxn:
        payload.listing_mode === "buy" ? null : payload.rent_price_per_day_mxn ?? null,
      security_deposit_mxn:
        payload.listing_mode === "buy" ? 0 : payload.security_deposit_mxn ?? 0,
      original_price_mxn: payload.original_price_mxn ?? null,
      recommended_sale_price_mxn: payload.recommended_sale_price_mxn ?? rec.recommendedSalePriceMxn,
      recommended_rent_price_mxn: payload.recommended_rent_price_mxn ?? rec.recommendedRentPerDayMxn,
      meetup_zone: payload.meetup_zone,
      images: payload.images,
      tags: payload.tags,
      status: "active",
    })
    .select("*, seller:profiles!listings_seller_id_fkey(*)")
    .single();

  if (error) {
    return jsonResponse(
      { error: "No se pudo publicar la prenda.", details: error.message },
      { status: 500, request }
    );
  }

  return jsonResponse({ listing: data }, { status: 201, request });
}
