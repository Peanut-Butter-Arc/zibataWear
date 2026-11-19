"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { createClient } from "@/lib/supabase/client";

export default function NuevaContrasenaPage() {
  const router = useRouter();
  const { user, loading, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setErrorMsg("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Las contraseñas no coinciden.");
      return;
    }

    setErrorMsg(null);
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMsg(error.message || "No se pudo actualizar tu contraseña.");
        return;
      }

      await refreshProfile();
      showToast(
        "¡Contraseña actualizada! Ya puedes iniciar sesión al instante.",
        "success"
      );
      router.replace("/cuenta");
    } catch {
      setErrorMsg("Error de red al guardar tu contraseña.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="h-80 animate-pulse rounded-3xl bg-zinc-200/70" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-lg items-center justify-center px-4 py-12">
        <div className="w-full space-y-5 rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
            <KeyRound className="h-3.5 w-3.5" />
            Sesión de recuperación no activa
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
            Tu enlace de recuperación expiró o no es válido
          </h1>
          <p className="text-sm leading-relaxed text-zinc-600">
            Solicita un nuevo código o enlace de recuperación para elegir tu nueva contraseña.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/auth?mode=forgot"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Solicitar nuevo código de recuperación
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/auth"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-zinc-200 px-5 text-sm font-semibold text-zinc-700 transition hover:border-zinc-950 hover:text-zinc-950"
            >
              Ir a iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-lg items-center justify-center px-4 py-12">
      <form
        onSubmit={handleSubmit}
        className="w-full space-y-5 rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm sm:p-10"
      >
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Recuperación verificada
          </span>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">
            Crea tu nueva contraseña
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Para <strong className="text-zinc-950">{user.email}</strong>. Luego podrás entrar sin códigos ni demoras.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
            Nueva contraseña (mínimo 8 caracteres)
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 pl-10 pr-11 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:bg-white"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-zinc-400 transition hover:text-zinc-800"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
            Confirmar nueva contraseña
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite tu contraseña"
              className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:bg-white"
            />
          </div>
        </div>

        {errorMsg && (
          <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
            {errorMsg}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
        >
          {saving ? "Guardando contraseña..." : "Guardar nueva contraseña"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
