import { z } from "zod";
import {
  createApiSupabaseClient,
  ensureUserProfile,
  handleCorsOptions,
  jsonResponse,
  PUBLIC_PROFILE_SELECT,
} from "@/lib/supabase/api-auth";

const toggleFavoriteSchema = z.object({
  listingId: z.string().uuid("Prenda inválida."),
});

export async function OPTIONS(request: Request) {
  return handleCorsOptions(request);
}

export async function GET(request: Request) {
  const { supabase, user } = await createApiSupabaseClient(request);
  if (!user) {
    return jsonResponse({ favoriteIds: [], listings: [] }, { request });
  }

  const { data, error } = await supabase
    .from("favorites")
    .select(`listing_id, listing:listings!favorites_listing_id_fkey(*, seller:profiles!listings_seller_id_fkey(${PUBLIC_PROFILE_SELECT}))`)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return jsonResponse({ error: "Error cargando favoritos." }, { status: 500, request });
  }

  const rows = data ?? [];
  const favoriteIds = rows.map((row) => row.listing_id);
  const listings = rows
    .map((row) => row.listing)
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return jsonResponse({ favoriteIds, listings }, { request });
}

export async function POST(request: Request) {
  const { supabase, user } = await createApiSupabaseClient(request);
  if (!user) {
    return jsonResponse({ error: "Inicia sesión para guardar favoritos." }, { status: 401, request });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Cuerpo JSON inválido." }, { status: 400, request });
  }

  const parsed = toggleFavoriteSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: "Prenda inválida." }, { status: 400, request });
  }

  await ensureUserProfile(supabase, user);

  const { data: existing } = await supabase
    .from("favorites")
    .select("listing_id")
    .eq("user_id", user.id)
    .eq("listing_id", parsed.data.listingId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("listing_id", parsed.data.listingId);
    return jsonResponse({ favorited: false }, { request });
  }

  const { error } = await supabase.from("favorites").insert({
    user_id: user.id,
    listing_id: parsed.data.listingId,
  });

  if (error) {
    return jsonResponse({ error: "No se pudo guardar en favoritos." }, { status: 500, request });
  }

  return jsonResponse({ favorited: true }, { status: 201, request });
}
