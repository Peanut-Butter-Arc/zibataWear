import { randomUUID } from "node:crypto";
import {
  createApiSupabaseClient,
  handleCorsOptions,
  jsonResponse,
} from "@/lib/supabase/api-auth";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export async function OPTIONS(request: Request) {
  return handleCorsOptions(request);
}

export async function POST(request: Request) {
  const { supabase, user } = await createApiSupabaseClient(request);
  if (!user) {
    return jsonResponse({ error: "Inicia sesión para subir fotos." }, { status: 401, request });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return jsonResponse({ error: "Archivo no recibido." }, { status: 400, request });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return jsonResponse(
      { error: "Formato no permitido. Usa JPG, PNG, WebP o AVIF." },
      { status: 400, request }
    );
  }

  if (file.size > 5 * 1024 * 1024) {
    return jsonResponse({ error: "La imagen excede 5 MB." }, { status: 400, request });
  }

  const ext = EXT_MAP[file.type] ?? "jpg";
  const path = `${user.id}/${randomUUID()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("garment-images")
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return jsonResponse(
      { error: "No se pudo subir la imagen.", details: uploadError.message },
      { status: 500, request }
    );
  }

  const { data: publicUrlData } = supabase.storage
    .from("garment-images")
    .getPublicUrl(path);

  return jsonResponse({ url: publicUrlData.publicUrl, path }, { status: 201, request });
}
