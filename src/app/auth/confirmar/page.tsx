"use client";

import type { EmailOtpType } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { createClient } from "@/lib/supabase/client";

function ConfirmarContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshProfile } = useAuth();
  const { showToast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const tokenHash = searchParams.get("token_hash")?.trim() ?? "";
  const rawType = searchParams.get("type") as EmailOtpType | null;
  const normalizedType: EmailOtpType = rawType ?? "email";
  const defaultNext =
    normalizedType === "recovery" ? "/auth/nueva-contrasena" : "/cuenta";
  const rawNext = searchParams.get("next") ?? defaultNext;
  const nextPath =
    rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : defaultNext;

  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!tokenHash) return;
    setErrorMsg(null);
    setVerifying(true);
    try {
      let { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: normalizedType,
      });

      if (
        error &&
        (normalizedType === "signup" || normalizedType === "magiclink")
      ) {
        const fallback = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "email",
        });
        error = fallback.error;
      }

      if (error) {
        setErrorMsg(
          "Este enlace ya expiró o fue utilizado. Solicita un nuevo código en zibataWear."
        );
        return;
      }

      await refreshProfile();

      if (normalizedType === "recovery") {
        showToast("Enlace verificado. Crea tu nueva contraseña.", "success");
        router.replace("/auth/nueva-contrasena");
        return;
      }

      const profileRes = await fetch("/api/v1/profile");
      const profileJson = await profileRes.json().catch(() => ({}));
      if (!profileJson?.profile?.full_name?.trim()) {
        router.replace("/auth");
        return;
      }

      showToast("Sesión confirmada en zibataWear", "success");
      router.replace(nextPath);
    } catch {
      setErrorMsg("No pudimos validar tu enlace. Intenta de nuevo.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-lg items-center justify-center px-4 py-12">
      <div className="w-full rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm sm:p-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          <ShieldCheck className="h-3.5 w-3.5" />
          Verificación protegida Zibatá
        </div>

        {!tokenHash ? (
          <div className="mt-5 space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
              Enlace incompleto o inválido
            </h1>
            <p className="text-sm text-zinc-600">
              Este enlace no incluye un token de verificación válido. Solicita uno nuevo desde el acceso.
            </p>
            <Link
              href={
                normalizedType === "recovery" ? "/auth?mode=forgot" : "/auth"
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Ir a iniciar sesión
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
                {normalizedType === "recovery"
                  ? "Restablecer tu contraseña"
                  : "Confirma tu acceso a zibataWear"}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                Toca el botón para validar tu acceso de forma segura (protegido contra filtros de correo universitario).
              </p>
            </div>

            {errorMsg && (
              <div className="space-y-2 rounded-xl bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
                <p>{errorMsg}</p>
                <Link
                  href={
                    normalizedType === "recovery" ? "/auth?mode=forgot" : "/auth"
                  }
                  className="inline-flex items-center gap-1 font-semibold text-zinc-950 underline"
                >
                  Solicitar un nuevo código →
                </Link>
              </div>
            )}

            <button
              type="button"
              disabled={verifying}
              onClick={handleConfirm}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
            >
              {normalizedType === "recovery" ? (
                <KeyRound className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {verifying
                ? "Verificando acceso..."
                : normalizedType === "recovery"
                  ? "Continuar y cambiar contraseña"
                  : "Confirmar y entrar a zibataWear"}
            </button>

            <p className="text-center text-xs text-zinc-500">
              <Link href="/auth" className="font-medium text-zinc-800 underline">
                Volver al inicio de sesión
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ConfirmarPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-4 py-16">
          <div className="h-72 animate-pulse rounded-3xl bg-zinc-200/70" />
        </div>
      }
    >
      <ConfirmarContent />
    </Suspense>
  );
}
