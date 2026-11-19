import { sendMessageSchema } from "@/core/schemas/validation";
import {
  createApiSupabaseClient,
  ensureUserProfile,
  handleCorsOptions,
  jsonResponse,
} from "@/lib/supabase/api-auth";

export async function OPTIONS(request: Request) {
  return handleCorsOptions(request);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { supabase, user } = await createApiSupabaseClient(request);

  if (!user) {
    return jsonResponse({ error: "Debes iniciar sesión." }, { status: 401, request });
  }

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    return jsonResponse({ error: "Error cargando mensajes." }, { status: 500, request });
  }

  return jsonResponse({ messages: data ?? [] }, { request });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { supabase, user } = await createApiSupabaseClient(request);

  if (!user) {
    return jsonResponse({ error: "Debes iniciar sesión." }, { status: 401, request });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Cuerpo JSON inválido." }, { status: 400, request });
  }

  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      { error: parsed.error.issues[0]?.message ?? "Mensaje inválido." },
      { status: 400, request }
    );
  }

  await ensureUserProfile(supabase, user);

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: id,
      sender_id: user.id,
      body: parsed.data.body,
    })
    .select("*")
    .single();

  if (error) {
    return jsonResponse(
      { error: "No pudimos enviar el mensaje.", details: error.message },
      { status: 403, request }
    );
  }

  return jsonResponse({ message: data }, { status: 201, request });
}
