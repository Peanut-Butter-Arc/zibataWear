"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
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

type AuthStep = "email" | "otp" | "forgot" | "reset-password" | "onboarding";
type AuthMethod = "otp" | "password";
type PasswordMode = "signin" | "signup";

function isCooldownError(message: string): boolean {
  return /security purposes|after \d+ second|wait/i.test(message);
}

function isGlobalRateLimitError(message: string, status?: number): boolean {
  if (isCooldownError(message)) return false;
  return status === 429 || /rate limit|over_email_send_rate_limit/i.test(message);
}

function formatAuthError(message: string, status?: number): string {
  if (isCooldownError(message)) {
    const sec = message.match(/after\s+(\d+)\s+second/i)?.[1];
    return sec
      ? `Por seguridad, espera ${sec} segundos antes de solicitar otro correo.`
      : "Por seguridad, espera unos segundos antes de solicitar otro correo.";
  }
  if (status === 429 || /rate limit|over_email_send_rate_limit/i.test(message)) {
    return "Se alcanzó el límite temporal de correos de Supabase (2/hora con el servidor gratuito por defecto). Configura Custom SMTP en Supabase para subir el límite o intenta de nuevo más tarde.";
  }
  if (/not authorized|email_address_not_authorized/i.test(message)) {
    return "El servidor de correos interno de Supabase solo permite correos del equipo. Configura Custom SMTP en Supabase para enviar a cualquier correo universitario.";
  }
  if (/invalid login credentials/i.test(message)) {
    return "Correo o contraseña incorrectos. Si antes entrabas solo con código, inicia con código y configura tu contraseña en Mi cuenta → Perfil.";
  }
  if (/email not confirmed/i.test(message)) {
    return "Tu correo aún no está confirmado. Revisa tu bandeja o entra usando un código de 6 dígitos.";
  }
  if (/user already registered|already been registered/i.test(message)) {
    return "Este correo ya está registrado. Inicia sesión con tu contraseña o con código de 6 dígitos.";
  }
  if (/password should be at least|weak_password/i.test(message)) {
    return "Tu contraseña debe tener al menos 8 caracteres.";
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
  const initialStep: AuthStep =
    searchParams.get("mode") === "forgot" ? "forgot" : "email";
  const urlErrorMessage =
    urlErrorParam === "link_invalido"
      ? "El enlace de acceso expiró o ya fue utilizado. Solicita un nuevo código."
      : null;

  const supabase = useMemo(() => createClient(), []);
  const { user, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState<AuthStep>(initialStep);
  const [authMethod, setAuthMethod] = useState<AuthMethod>("otp");
  const [passwordMode, setPasswordMode] = useState<PasswordMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otpType, setOtpType] = useState<"email" | "signup" | "recovery">("email");
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [urlErrorDismissed, setUrlErrorDismissed] = useState(false);
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Recovery reset-password fields
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingNewPassword, setSavingNewPassword] = useState(false);

  // Onboarding fields
  const [fullName, setFullName] = useState("");
  const [university, setUniversity] = useState("Universidad Anáhuac Querétaro");
  const [major, setMajor] = useState("");
  const [campusZone, setCampusZone] = useState<string>(ZIBATA_MEETUP_ZONES[0]);
  const [onboardingPassword, setOnboardingPassword] = useState("");
  const [showOnboardingPassword, setShowOnboardingPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const isUni = isUniversityEmail(email);

  const needsOnboarding = Boolean(user && profile && !profile.full_name?.trim());
  const effectiveStep: AuthStep =
    step === "reset-password"
      ? "reset-password"
      : needsOnboarding
        ? "onboarding"
        : step;
  const displayedError =
    errorMsg ?? (!urlErrorDismissed ? urlErrorMessage : null);

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

  const handleSendRecovery = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMsg("Ingresa un correo electrónico válido.");
      return;
    }

    setErrorMsg(null);
    setUrlErrorDismissed(true);
    setIsRateLimited(false);
    setSending(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/auth/nueva-contrasena")}`,
      });

      if (error) {
        if (isGlobalRateLimitError(error.message, error.status)) {
          setIsRateLimited(true);
        }
        setErrorMsg(formatAuthError(error.message, error.status));
        return;
      }

      setOtpType("recovery");
      setStep("otp");
      setCooldown(60);
      showToast(
        `Te enviamos instrucciones de recuperación a ${cleanEmail}`,
        "success"
      );
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch {
      setErrorMsg("No pudimos enviar el correo de recuperación. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  };

  const handleSendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (otpType === "recovery" && step === "otp") {
      await handleSendRecovery();
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMsg("Ingresa un correo electrónico válido.");
      return;
    }

    setErrorMsg(null);
    setUrlErrorDismissed(true);
    setIsRateLimited(false);
    setSending(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const redirectUrl = `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

      if (otpType === "signup" && step === "otp") {
        const { error } = await supabase.auth.resend({
          type: "signup",
          email: cleanEmail,
          options: {
            emailRedirectTo: redirectUrl,
          },
        });
        if (error) {
          if (isGlobalRateLimitError(error.message, error.status)) {
            setIsRateLimited(true);
          }
          setErrorMsg(formatAuthError(error.message, error.status));
          return;
        }
      } else {
        setOtpType("email");
        const { error } = await supabase.auth.signInWithOtp({
          email: cleanEmail,
          options: {
            shouldCreateUser: true,
            emailRedirectTo: redirectUrl,
          },
        });

        if (error) {
          if (isGlobalRateLimitError(error.message, error.status)) {
            setIsRateLimited(true);
          }
          setErrorMsg(formatAuthError(error.message, error.status));
          return;
        }
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

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMsg("Ingresa un correo electrónico válido.");
      return;
    }
    if (passwordMode === "signup" && password.length < 8) {
      setErrorMsg("Tu contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (passwordMode === "signin" && password.length === 0) {
      setErrorMsg("Ingresa tu contraseña.");
      return;
    }
    if (passwordMode === "signup" && password !== confirmPassword) {
      setErrorMsg("Las contraseñas no coinciden.");
      return;
    }

    setErrorMsg(null);
    setUrlErrorDismissed(true);
    setIsRateLimited(false);
    setSending(true);
    try {
      if (passwordMode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          setErrorMsg(formatAuthError(error.message, error.status));
          return;
        }

        await refreshProfile();
        showToast("Sesión iniciada en zibataWear", "success");

        const profileRes = await fetch("/api/v1/profile");
        const profileJson = await profileRes.json().catch(() => ({}));
        if (data.user && !profileJson?.profile?.full_name?.trim()) {
          setStep("onboarding");
        } else {
          router.replace(nextPath);
        }
        return;
      }

      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });

      if (error) {
        if (isGlobalRateLimitError(error.message, error.status)) {
          setIsRateLimited(true);
        }
        setErrorMsg(formatAuthError(error.message, error.status));
        return;
      }

      if (data.session) {
        await refreshProfile();
        showToast("Cuenta creada en zibataWear", "success");
        const profileRes = await fetch("/api/v1/profile");
        const profileJson = await profileRes.json().catch(() => ({}));
        if (data.user && !profileJson?.profile?.full_name?.trim()) {
          setStep("onboarding");
        } else {
          router.replace(nextPath);
        }
        return;
      }

      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setPasswordMode("signin");
        setErrorMsg(
          "Este correo ya tiene cuenta. Inicia sesión con tu contraseña o con código de 6 dígitos."
        );
        return;
      }

      setOtpType("signup");
      setStep("otp");
      setCooldown(60);
      showToast(`Código de confirmación enviado a ${cleanEmail}`, "success");
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch {
      setErrorMsg("No pudimos completar el acceso. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  };

  const verifyOtpCode = async (codeValue: string) => {
    if (codeValue.length !== 6) return;
    setErrorMsg(null);
    setVerifying(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      let { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: codeValue,
        type: otpType,
      });

      if (error && otpType === "signup") {
        const fallback = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: codeValue,
          type: "email",
        });
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        setErrorMsg("Código incorrecto o expirado. Verifica e intenta de nuevo.");
        return;
      }

      if (otpType === "recovery") {
        showToast("Código de recuperación verificado", "success");
        setDigits(["", "", "", "", "", ""]);
        setStep("reset-password");
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

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setErrorMsg("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMsg("Las contraseñas no coinciden.");
      return;
    }

    setErrorMsg(null);
    setSavingNewPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        setErrorMsg(error.message || "No se pudo actualizar tu contraseña.");
        return;
      }

      await refreshProfile();
      showToast("¡Contraseña actualizada!", "success");

      const profileRes = await fetch("/api/v1/profile");
      const profileJson = await profileRes.json().catch(() => ({}));
      if (!profileJson?.profile?.full_name?.trim()) {
        setStep("onboarding");
      } else {
        router.replace(nextPath);
      }
    } catch {
      setErrorMsg("Error de red al guardar tu nueva contraseña.");
    } finally {
      setSavingNewPassword(false);
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
    const cleanOnboardingPass = onboardingPassword.trim();
    if (cleanOnboardingPass.length > 0 && cleanOnboardingPass.length < 8) {
      setErrorMsg("Si deseas contraseña rápida, debe tener al menos 8 caracteres.");
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

      if (cleanOnboardingPass.length >= 8) {
        const { error: passError } = await supabase.auth.updateUser({
          password: cleanOnboardingPass,
        });
        if (passError) {
          showToast(
            "Perfil guardado, pero no se pudo guardar la contraseña; configúrala en Mi cuenta → Perfil.",
            "info"
          );
        }
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
              Acceso rápido y seguro
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight">
              Entra a zibataWear en segundos.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              Usa tu correo universitario o personal. Elige entre código único
              de 6 dígitos o entra al instante con tu contraseña.
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
              <Lock className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>
                Configura tu contraseña una vez y vuelve a iniciar sesión en cualquier momento sin esperar correos.
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
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Paso 1 de 2
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
                  {authMethod === "otp"
                    ? "Ingresa con código de verificación"
                    : passwordMode === "signin"
                      ? "Inicia sesión con tu contraseña"
                      : "Crea tu cuenta con contraseña"}
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  {authMethod === "otp"
                    ? "Si aún no tienes cuenta, se creará automáticamente al verificar tu código."
                    : passwordMode === "signin"
                      ? "Entra al instante sin depender de límites o demoras de correo."
                      : "Regístrate con correo y contraseña para entrar siempre en un toque."}
                </p>
              </div>

              {/* Dual Auth Method Switcher */}
              <div
                role="tablist"
                aria-label="Método de acceso"
                className="grid grid-cols-2 gap-1 rounded-2xl border border-zinc-200 bg-zinc-100 p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMethod === "otp"}
                  onClick={() => {
                    setAuthMethod("otp");
                    setErrorMsg(null);
                    setUrlErrorDismissed(true);
                    setIsRateLimited(false);
                  }}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:text-sm",
                    authMethod === "otp"
                      ? "bg-white text-zinc-950 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-900"
                  )}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Código de 6 dígitos
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMethod === "password"}
                  onClick={() => {
                    setAuthMethod("password");
                    setErrorMsg(null);
                    setUrlErrorDismissed(true);
                    setIsRateLimited(false);
                  }}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition sm:text-sm",
                    authMethod === "password"
                      ? "bg-white text-zinc-950 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-900"
                  )}
                >
                  <Lock className="h-3.5 w-3.5" />
                  Correo y contraseña
                </button>
              </div>

              {authMethod === "otp" ? (
                <form onSubmit={handleSendCode} className="space-y-5">
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
                    <div className="space-y-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                      <p>{displayedError}</p>
                      {isRateLimited && (
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMethod("password");
                            setPasswordMode("signin");
                            setErrorMsg(null);
                            setIsRateLimited(false);
                          }}
                          className="inline-flex items-center gap-1 font-semibold text-zinc-950 underline hover:text-zinc-700"
                        >
                          ¿Ya tienes contraseña? Entrar con contraseña →
                        </button>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={sending}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
                  >
                    {sending ? "Enviando código..." : "Enviar código de 6 dígitos"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handlePasswordAuth} className="space-y-4">
                  <div className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordMode("signin");
                        setErrorMsg(null);
                        setIsRateLimited(false);
                      }}
                      className={cn(
                        "rounded-full px-3.5 py-1.5 font-semibold transition",
                        passwordMode === "signin"
                          ? "bg-zinc-950 text-white"
                          : "text-zinc-600 hover:text-zinc-950"
                      )}
                    >
                      Iniciar sesión
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordMode("signup");
                        setErrorMsg(null);
                        setIsRateLimited(false);
                      }}
                      className={cn(
                        "rounded-full px-3.5 py-1.5 font-semibold transition",
                        passwordMode === "signup"
                          ? "bg-zinc-950 text-white"
                          : "text-zinc-600 hover:text-zinc-950"
                      )}
                    >
                      Crear cuenta
                    </button>
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
                        autoComplete="email"
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

                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label className="block text-xs font-semibold text-zinc-700">
                        Contraseña {passwordMode === "signup" ? "(mínimo 8 caracteres)" : ""}
                      </label>
                      {passwordMode === "signin" && (
                        <button
                          type="button"
                          onClick={() => {
                            setErrorMsg(null);
                            setUrlErrorDismissed(true);
                            setIsRateLimited(false);
                            setStep("forgot");
                          }}
                          className="text-xs font-semibold text-zinc-700 underline hover:text-zinc-950"
                        >
                          ¿Olvidaste tu contraseña?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete={
                          passwordMode === "signin" ? "current-password" : "new-password"
                        }
                        minLength={passwordMode === "signup" ? 8 : undefined}
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

                  {passwordMode === "signup" && (
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                        Confirmar contraseña
                      </label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          autoComplete="new-password"
                          minLength={8}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Repite tu contraseña"
                          className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:bg-white"
                        />
                      </div>
                    </div>
                  )}

                  {passwordMode === "signin" && (
                    <p className="rounded-xl bg-emerald-50/70 px-3 py-2 text-xs text-emerald-800">
                      Entra al instante sin consumir cuota de correos.
                    </p>
                  )}

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
                    {sending
                      ? passwordMode === "signin"
                        ? "Iniciando sesión..."
                        : "Creando cuenta..."
                      : passwordMode === "signin"
                        ? "Iniciar sesión"
                        : "Crear cuenta"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              )}

              <p className="text-center text-xs text-zinc-500">
                Al continuar aceptas las reglas de entrega segura en Zibatá.{" "}
                <Link href="/" className="font-medium text-zinc-900 underline">
                  Volver al catálogo
                </Link>
              </p>
            </div>
          )}

          {effectiveStep === "forgot" && (
            <form onSubmit={handleSendRecovery} className="space-y-5">
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setAuthMethod("password");
                    setPasswordMode("signin");
                    setErrorMsg(null);
                    setUrlErrorDismissed(true);
                  }}
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-950"
                >
                  ← Volver a iniciar sesión
                </button>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
                  Recupera tu contraseña
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Te enviaremos un código o enlace seguro para crear una contraseña nueva.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Correo registrado
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu.nombre@anahuac.mx"
                    className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:bg-white"
                  />
                </div>
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
                {sending
                  ? "Enviando recuperación..."
                  : "Enviar código / enlace de recuperación"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}

          {effectiveStep === "otp" && (
            <div className="space-y-6">
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setStep(otpType === "recovery" ? "forgot" : "email");
                    setDigits(["", "", "", "", "", ""]);
                    setErrorMsg(null);
                  }}
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-950"
                >
                  ← Cambiar correo ({email})
                </button>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
                  {otpType === "recovery"
                    ? "Código de recuperación de 6 dígitos"
                    : "Escribe tu código de 6 dígitos"}
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Enviamos un correo de verificación a{" "}
                  <strong className="text-zinc-950">{email}</strong>.
                  {otpType === "recovery"
                    ? " Si tu correo trae un enlace, haz clic en él o ingresa el código de 6 dígitos aquí."
                    : ""}
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

          {effectiveStep === "reset-password" && (
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Recuperación verificada
                </span>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
                  Crea tu nueva contraseña
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Guarda una nueva contraseña segura para <strong className="text-zinc-950">{email}</strong>.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Nueva contraseña (mínimo 8 caracteres)
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 pl-10 pr-11 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    aria-label={showNewPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-zinc-400 transition hover:text-zinc-800"
                  >
                    {showNewPassword ? (
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
                    type={showNewPassword ? "text" : "password"}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
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
                disabled={savingNewPassword}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
              >
                {savingNewPassword ? "Guardando..." : "Guardar nueva contraseña"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
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

              {authMethod === "otp" && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-zinc-700">
                    Contraseña rápida (opcional, mín. 8 caracteres)
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input
                      type={showOnboardingPassword ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={8}
                      value={onboardingPassword}
                      onChange={(e) => setOnboardingPassword(e.target.value)}
                      placeholder="Crea una contraseña para entrar sin correo"
                      className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-10 text-sm outline-none focus:border-zinc-950 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOnboardingPassword((prev) => !prev)}
                      aria-label={
                        showOnboardingPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                      }
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-zinc-400 transition hover:text-zinc-800"
                    >
                      {showOnboardingPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Para volver a entrar sin esperar código por correo.
                  </p>
                </div>
              )}

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
