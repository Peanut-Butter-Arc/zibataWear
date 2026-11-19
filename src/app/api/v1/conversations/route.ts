import { createConversationSchema } from "@/core/schemas/validation";
import {
  createApiSupabaseClient,
  ensureUserProfile,
  handleCorsOptions,
  jsonResponse,
} from "@/lib/supabase/api-auth";

const CONVERSATION_SELECT = `
  *,
  listing:listings!conversations_listing_id_fkey(
    id, title, images, sale_price_mxn, rent_price_per_day_mxn, listing_mode, meetup_zone, status
  ),
  buyer:profiles!conversations_buyer_id_fkey(*),
  seller:profiles!conversations_seller_id_fkey(*)
`;

export async function OPTIONS(request: Request) {
  return handleCorsOptions(request);
}

export async function GET(request: Request) {
  const { supabase, user } = await createApiSupabaseClient(request);
  if (!user) {
    return jsonResponse({ error: "Debes iniciar sesión." }, { status: 401, request });
  }

  const { data, error } = await supabase
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order("last_message_at", { ascending: false });

  if (error) {
    return jsonResponse(
      { error: "No pudimos cargar tus conversaciones." },
      { status: 500, request }
    );
  }

  return jsonResponse({ conversations: data ?? [] }, { request });
}

export async function POST(request: Request) {
  const { supabase, user } = await createApiSupabaseClient(request);
  if (!user) {
    return jsonResponse({ error: "Inicia sesión para chatear." }, { status: 401, request });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Cuerpo JSON inválido." }, { status: 400, request });
  }

  const parsed = createConversationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: "Prenda inválida." }, { status: 400, request });
  }

  await ensureUserProfile(supabase, user);

  const { data: listing, error: listingErr } = await supabase
    .from("listings")
    .select("id, seller_id, title")
    .eq("id", parsed.data.listingId)
    .maybeSingle();

  if (listingErr || !listing) {
    return jsonResponse({ error: "Prenda no encontrada." }, { status: 404, request });
  }

  if (listing.seller_id === user.id) {
    return jsonResponse(
      { error: "No puedes iniciar un chat sobre tu propia prenda." },
      { status: 400, request }
    );
  }

  const { data: existing } = await supabase
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .eq("listing_id", listing.id)
    .eq("buyer_id", user.id)
    .eq("seller_id", listing.seller_id)
    .maybeSingle();

  if (existing) {
    return jsonResponse({ conversation: existing }, { request });
  }

  const { data: created, error: insertErr } = await supabase
    .from("conversations")
    .insert({
      listing_id: listing.id,
      buyer_id: user.id,
      seller_id: listing.seller_id,
      last_message_text: `Interés en: ${listing.title}`.slice(0, 140),
    })
    .select(CONVERSATION_SELECT)
    .single();

  if (insertErr) {
    return jsonResponse(
      { error: "No se pudo crear la conversación.", details: insertErr.message },
      { status: 500, request }
    );
  }

  return jsonResponse({ conversation: created }, { status: 201, request });
}
