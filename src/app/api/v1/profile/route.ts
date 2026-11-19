import { updateProfileSchema } from "@/core/schemas/validation";
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
  const { supabase, user } = await createApiSupabaseClient(request);
  if (!user) {
    return jsonResponse({ profile: null }, { status: 200, request });
  }

  const profile = await ensureUserProfile(supabase, user);
  return jsonResponse({ profile, email: user.email ?? null }, { request });
}

export async function PATCH(request: Request) {
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

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400, request }
    );
  }

  await ensureUserProfile(supabase, user);

  const updates: Record<string, unknown> = {
    full_name: parsed.data.full_name,
  };
  if (parsed.data.username !== undefined) {
    updates.username = parsed.data.username ? parsed.data.username.toLowerCase() : null;
  }
  if (parsed.data.university !== undefined) updates.university = parsed.data.university;
  if (parsed.data.major !== undefined) updates.major = parsed.data.major;
  if (parsed.data.campus_zone !== undefined) updates.campus_zone = parsed.data.campus_zone;
  if (parsed.data.bio !== undefined) updates.bio = parsed.data.bio;

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return jsonResponse({ error: "Ese @usuario ya está en uso." }, { status: 409, request });
    }
    return jsonResponse({ error: "No se pudo actualizar el perfil." }, { status: 500, request });
  }

  return jsonResponse({ profile: data }, { request });
}
