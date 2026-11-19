"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  KeyRound,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { isUniversityEmail, ZIBATA_MEETUP_ZONES } from "@/core/constants/zibata";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type AuthStep = "email" | "otp" | "onboarding";

function formatAuthError(message: string, status?: number): string {
  if (status === 429 || /rate limit|over_email_send_rate_limit/i.test(message)) {
    return "Se alcanzó el límite temporal de correos de Supabase (2/hora con el servidor gratuito por defecto). Configura Custom SMTP en Supabase para subir el límite o intenta de nuevo más tarde.";
  }
  if (/not authorized|email_address_not_authorized/i.test(message)) {
    return "El servidor de correos interno de Supabase solo permite correos del equipo. Configura Custom SMTP en Supabase para enviar a cualquier correo universitario.";
  }
  if (/security purposes|seconds|wait/i.test(message)) {
    return "Por seguridad, espera unos segundos antes de solicitar otro código para este correo.";
  }
  return message;
}

function AuthFlowContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next") ?? "/cuenta";
  const nextPath =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/cuenta";
  const urlErrorParam = searchParams.get("error");
  const urlErrorMessage =
    urlErrorParam === "link_invalido"
      ? "El enlace de acceso expiró o ya fue utilizado. Solicita un nuevo código."
      : null;

  const supabase = useMemo(() => createClient(), []);
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Onboarding fields
  const [fullName, setFullName] = useState("");
  const [university, setUniversity] = useState("Universidad Anáhuac Querétaro");
  const [major, setMajor] = useState("");
  const [campusZone, setCampusZone] = useState<string>(ZIBATA_MEETUP_ZONES[0]);
  const [savingProfile, setSavingProfile] = useState(false);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const isUni = isUniversityEmail(email);

  const needsOnboarding = Boolean(user && profile && !profile.full_name?.trim());
  const effectiveStep: AuthStep = needsOnboarding ? "onboarding" : step;
  const displayedError = errorMsg ?? urlErrorMessage;

  useEffect(() => {
    if (user && profile?.full_name?.trim() && step === "email") {
      router.replace(nextPath);
    }
  }, [user, profile, nextPath, router, step]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMsg("Ingresa un correo electrónico válido.");
      return;
    }

    setErrorMsg(null);
    setSending(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });

      if (error) {
        setErrorMsg(formatAuthError(error.message, error.status));
        return;
      }

      setStep("otp");
      setCooldown(60);
      showToast(`Código enviado a ${cleanEmail}`, "success");
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch {
      setErrorMsg("No pudimos enviar el código. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  };

  const verifyOtpCode = async (codeValue: string) => {
    if (codeValue.length !== 6) return;
    setErrorMsg(null);
    setVerifying(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: codeValue,
        type: "email",
      });

      if (error) {
        setErrorMsg("Código incorrecto o expirado. Verifica e intenta de nuevo.");
        return;
      }

      await refreshProfile();
      showToast("Sesión verificada en zibataWear", "success");

      // Check if user already completed profile
      const profileRes = await fetch("/api/v1/profile");
      const profileJson = await profileRes.json().catch(() => ({}));
      if (data.user && !profileJson?.profile?.full_name?.trim()) {
        setStep("onboarding");
      } else {
        router.replace(nextPath);
      }
    } catch {
      setErrorMsg("Error verificando el código.");
    } finally {
      setVerifying(false);
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, "");
    if (!clean) {
      setDigits((prev) => {
        const next = [...prev];
        next[index] = "";
        return next;
      });
      return;
    }

    if (clean.length > 1) {
      const pasted = clean.slice(0, 6).split("");
      const next = ["", "", "", "", "", ""];
      pasted.forEach((ch, idx) => {
        next[idx] = ch;
      });
      setDigits(next);
      const focusIdx = Math.min(5, pasted.length);
      inputRefs.current[focusIdx]?.focus();
      if (pasted.length === 6) {
        verifyOtpCode(next.join(""));
      }
      return;
    }

    const next = [...digits];
    next[index] = clean;
    setDigits(next);

    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    const fullCode = next.join("");
    if (fullCode.length === 6) {
      verifyOtpCode(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSaveOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 2) {
      setErrorMsg("Escribe tu nombre para que otros estudiantes te reconozcan.");
      return;
    }
    setErrorMsg(null);
    setSavingProfile(true);
    try {
      const res = await fetch("/api/v1/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          university: university.trim(),
          major: major.trim(),
          campus_zone: campusZone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "No pudimos guardar tu perfil.");
        return;
      }
      await refreshProfile();
      showToast("¡Bienvenido a zibataWear!", "success");
      router.replace(nextPath);
    } catch {
      setErrorMsg("Error de red al guardar perfil.");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-5xl items-center justify-center px-4 py-10 sm:px-6">
      <div className="grid w-full overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm lg:grid-cols-12">
        {/* Left Silicon Valley Brand Panel */}
        <div className="flex flex-col justify-between bg-zinc-950 p-8 text-white lg:col-span-5 lg:p-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-emerald-300">
              <KeyRound className="h-3.5 w-3.5" />
              Autenticación sin contraseñas
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight">
              Entra a zibataWear en segundos.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              Usa tu correo universitario o personal. Te enviamos un código único
              de 6 dígitos para acceder de forma segura en web y móvil.
            </p>
          </div>

          <div className="mt-8 space-y-3 border-t border-white/10 pt-6 text-xs text-zinc-300">
            <div className="flex items-center gap-2.5">
              <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>
                Correos <strong className="text-white">@anahuac.mx</strong> o{" "}
                <strong className="text-white">.edu.mx</strong> obtienen insignia
                verificada automática.
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>Sesión segura lista para compras, rentas y chat en vivo.</span>
            </div>
          </div>
        </div>

        {/* Right Interactive Auth Form */}
        <div className="p-8 sm:p-10 lg:col-span-7">
          {effectiveStep === "email" && (
            <form onSubmit={handleSendCode} className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Paso 1 de 2
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
                  Ingresa con código de verificación
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Si aún no tienes cuenta, se creará automáticamente al verificar tu código.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Correo universitario o personal
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu.nombre@anahuac.mx"
                    className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:bg-white"
                  />
                </div>

                {email.includes("@") && (
                  <div
                    className={cn(
                      "mt-2.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                      isUni
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-zinc-100 text-zinc-600"
                    )}
                  >
                    {isUni ? (
                      <>
                        <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
                        Recibirás insignia de Universitario Verificado
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5 text-zinc-500" />
                        Acceso Comunidad Zibatá (puedes usar @anahuac.mx para verificación uni)
                      </>
                    )}
                  </div>
                )}
              </div>

              {displayedError && (
                <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                  {displayedError}
                </p>
              )}

              <button
                type="submit"
                disabled={sending}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
              >
                {sending ? "Enviando código..." : "Enviar código de 6 dígitos"}
                <ArrowRight className="h-4 w-4" />
              </button>

              <p className="text-center text-xs text-zinc-500">
                Al continuar aceptas las reglas de entrega segura en Zibatá.{" "}
                <Link href="/" className="font-medium text-zinc-900 underline">
                  Volver al catálogo
                </Link>
              </p>
            </form>
          )}

          {effectiveStep === "otp" && (
            <div className="space-y-6">
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setDigits(["", "", "", "", "", ""]);
                    setErrorMsg(null);
                  }}
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-950"
                >
                  ← Cambiar correo ({email})
                </button>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
                  Escribe tu código de 6 dígitos
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Enviamos un código de verificación a{" "}
                  <strong className="text-zinc-950">{email}</strong>.
                </p>
              </div>

              {/* 6-Digit Input Grid */}
              <div className="grid grid-cols-6 gap-2 sm:gap-3">
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    aria-label={`Dígito ${index + 1}`}
                    className="h-14 w-full rounded-2xl border border-zinc-200 bg-zinc-50 text-center font-mono text-xl font-bold text-zinc-950 outline-none transition focus:border-zinc-950 focus:bg-white focus:ring-2 focus:ring-zinc-950/10 sm:h-16 sm:text-2xl"
                  />
                ))}
              </div>

              {errorMsg && (
                <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                  {errorMsg}
                </p>
              )}

              <button
                type="button"
                disabled={verifying || digits.join("").length !== 6}
                onClick={() => verifyOtpCode(digits.join(""))}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {verifying ? "Verificando..." : "Verificar código e ingresar"}
              </button>

              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>¿No ves el correo? Revisa Spam o Promociones.</span>
                <button
                  type="button"
                  disabled={cooldown > 0 || sending}
                  onClick={() => handleSendCode()}
                  className="inline-flex items-center gap-1 font-semibold text-zinc-950 disabled:text-zinc-400"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {cooldown > 0 ? `Reenviar en ${cooldown}s` : "Reenviar código"}
                </button>
              </div>
            </div>
          )}

          {effectiveStep === "onboarding" && (
            <form onSubmit={handleSaveOnboarding} className="space-y-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Código verificado
                </span>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
                  Completa tu perfil universitario
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Solo toma 10 segundos para generar confianza en tus entregas en Zibatá.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-700">
                  Nombre completo
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej. Camila Hernández"
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-sm outline-none focus:border-zinc-950 focus:bg-white"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-700">
                    Universidad
                  </label>
                  <input
                    type="text"
                    value={university}
                    onChange={(e) => setUniversity(e.target.value)}
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-sm outline-none focus:border-zinc-950 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-700">
                    Carrera (opcional)
                  </label>
                  <input
                    type="text"
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    placeholder="Ej. Negocios Internacionales"
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-sm outline-none focus:border-zinc-950 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-700">
                  Punto de entrega preferido en Zibatá
                </label>
                <select
                  value={campusZone}
                  onChange={(e) => setCampusZone(e.target.value)}
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-sm outline-none focus:border-zinc-950 focus:bg-white"
                >
                  {ZIBATA_MEETUP_ZONES.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>

              {errorMsg && (
                <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={savingProfile}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
              >
                {savingProfile ? "Guardando..." : "Entrar a zibataWear"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-16">
          <div className="h-96 animate-pulse rounded-3xl bg-zinc-200/70" />
        </div>
      }
    >
      <AuthFlowContent />
    </Suspense>
  );
}
