import { updateListingSchema } from "@/core/schemas/validation";
import {
  createApiSupabaseClient,
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
  const { supabase } = await createApiSupabaseClient(request);

  const { data, error } = await supabase
    .from("listings")
    .select("*, seller:profiles!listings_seller_id_fkey(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return jsonResponse({ error: "Error consultando la prenda." }, { status: 500, request });
  }
  if (!data) {
    return jsonResponse({ error: "Prenda no encontrada." }, { status: 404, request });
  }

  return jsonResponse({ listing: data }, { request });
}

export async function PATCH(
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

  const parsed = updateListingSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400, request }
    );
  }

  const { data, error } = await supabase
    .from("listings")
    .update(parsed.data)
    .eq("id", id)
    .eq("seller_id", user.id)
    .select("*, seller:profiles!listings_seller_id_fkey(*)")
    .maybeSingle();

  if (error) {
    return jsonResponse({ error: "No se pudo actualizar la prenda." }, { status: 500, request });
  }
  if (!data) {
    return jsonResponse({ error: "Prenda no encontrada o sin permisos." }, { status: 404, request });
  }

  return jsonResponse({ listing: data }, { request });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { supabase, user } = await createApiSupabaseClient(request);

  if (!user) {
    return jsonResponse({ error: "Debes iniciar sesión." }, { status: 401, request });
  }

  const { data, error } = await supabase
    .from("listings")
    .delete()
    .eq("id", id)
    .eq("seller_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return jsonResponse(
      {
        error:
          "No se pudo eliminar (puede tener órdenes asociadas; mejor páusala desde tu cuenta).",
      },
      { status: 409, request }
    );
  }
  if (!data) {
    return jsonResponse({ error: "Prenda no encontrada o sin permisos." }, { status: 404, request });
  }

  return jsonResponse({ ok: true, id: data.id }, { request });
}
