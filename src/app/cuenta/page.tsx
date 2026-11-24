"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  ExternalLink,
  Eye,
  EyeOff,
  Heart,
  Landmark,
  Lock,
  LogOut,
  PauseCircle,
  PlayCircle,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
  User as UserIcon,
  Wallet,
} from "lucide-react";
import {
  formatMxn,
  PLATFORM_FEE_MIN_MXN,
  PLATFORM_FEE_PERCENT,
  ZIBATA_MEETUP_ZONES,
} from "@/core/constants/zibata";
import type {
  ListingWithSeller,
  OrderWithDetails,
  Profile,
  WalletTransaction,
} from "@/core/types/domain";
import { OrderEscrowCard } from "@/components/escrow/OrderEscrowCard";
import { ListingCard } from "@/components/marketplace/ListingCard";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type TabId = "perfil" | "prendas" | "ordenes" | "billetera" | "favoritos";

interface WalletSnapshot {
  balanceMxn: number;
  pendingMxn: number;
  stripeConnectAccountId: string | null;
  stripeConnectOnboarded: boolean;
  payoutClabe: string | null;
  payoutBank: string | null;
}

function ProfileEditorForm({
  profile,
  onSaved,
}: {
  profile: Profile | null;
  onSaved: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [username, setUsername] = useState(profile?.username || "");
  const [university, setUniversity] = useState(
    profile?.university || "Universidad Anáhuac Querétaro"
  );
  const [major, setMajor] = useState(profile?.major || "");
  const [campusZone, setCampusZone] = useState<string>(
    profile?.campus_zone || ZIBATA_MEETUP_ZONES[0]
  );
  const [bio, setBio] = useState(profile?.bio || "");
  const [savingProfile, setSavingProfile] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await fetch("/api/v1/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          username: username.trim(),
          university: university.trim(),
          major: major.trim(),
          campus_zone: campusZone,
          bio: bio.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "No se pudo guardar el perfil.", "error");
        return;
      }
      await onSaved();
      showToast("Perfil actualizado", "success");
    } catch {
      showToast("Error al guardar cambios.", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <form
      onSubmit={handleSaveProfile}
      className="max-w-2xl space-y-4 rounded-3xl border border-zinc-200 bg-white p-6"
    >
      <h2 className="text-base font-semibold text-zinc-950">
        Información universitaria
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
            Nombre completo
          </label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-sm outline-none focus:border-zinc-950 focus:bg-white"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
            @usuario (opcional)
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="camila_zibata"
            className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-sm outline-none focus:border-zinc-950 focus:bg-white"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
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
          <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
            Carrera / Semestre
          </label>
          <input
            type="text"
            value={major}
            onChange={(e) => setMajor(e.target.value)}
            placeholder="Ej. Arquitectura"
            className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-sm outline-none focus:border-zinc-950 focus:bg-white"
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
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

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
          Bio corta
        </label>
        <textarea
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Ej. Entrego entre clases en Campus Anáhuac o fines en Paseo Zibatá."
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-sm outline-none focus:border-zinc-950 focus:bg-white"
        />
      </div>

      <button
        type="submit"
        disabled={savingProfile}
        className="rounded-full bg-zinc-950 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
      >
        {savingProfile ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}

function PasswordSecurityCard() {
  const { showToast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      showToast("La contraseña debe tener al menos 8 caracteres.", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Las contraseñas no coinciden.", "error");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        showToast(
          error.message || "No se pudo actualizar tu contraseña.",
          "error"
        );
        return;
      }
      setNewPassword("");
      setConfirmPassword("");
      showToast(
        "Contraseña guardada. Ya puedes entrar sin esperar código por correo.",
        "success"
      );
    } catch {
      showToast("Error de red al guardar contraseña.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSavePassword}
      className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-950">
            <Lock className="h-4 w-4 text-emerald-600" />
            Acceso rápido con contraseña
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Configura una contraseña para volver a iniciar sesión al instante en{" "}
            <strong className="text-zinc-800">Correo y contraseña</strong> sin
            consumir correos de verificación.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
            Nueva contraseña (mín. 8 caracteres)
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 pr-10 text-sm outline-none focus:border-zinc-950 focus:bg-white"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-zinc-400 transition hover:text-zinc-800"
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
            Confirmar contraseña
          </label>
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repite la contraseña"
            className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-sm outline-none focus:border-zinc-950 focus:bg-white"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded-full border border-zinc-950 bg-white px-5 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-950 hover:text-white disabled:opacity-60 sm:text-sm"
      >
        {saving ? "Guardando..." : "Guardar contraseña rápida"}
      </button>
    </form>
  );
}

function WalletWithdrawalForm({
  wallet,
  onWithdrawn,
}: {
  wallet: WalletSnapshot;
  onWithdrawn: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [amount, setAmount] = useState(() =>
    wallet.balanceMxn >= 50 ? String(wallet.balanceMxn) : ""
  );
  const [clabe, setClabe] = useState(wallet.payoutClabe ?? "");
  const [bank, setBank] = useState(wallet.payoutBank ?? "");
  const [submitting, setSubmitting] = useState(false);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Math.floor(Number(amount));
    if (!Number.isFinite(num) || num < 50) {
      showToast("El retiro mínimo es de $50 MXN.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountMxn: num,
          clabe: clabe.replace(/\D/g, ""),
          bank: bank.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "No se pudo procesar el retiro.", "error");
        return;
      }
      showToast("Solicitud de retiro registrada correctamente", "success");
      setAmount("");
      await onWithdrawn();
    } catch {
      showToast("Error de red al solicitar retiro.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleWithdraw}
      className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-zinc-900" />
          <h3 className="text-base font-semibold text-zinc-950">
            Retiro bancario por CLABE (SPEI)
          </h3>
        </div>
        <span className="tabular-nums text-xs font-medium text-zinc-500">
          Disponible: {formatMxn(wallet.balanceMxn)}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-zinc-500">
        Si prefieres no usar Stripe Connect Express, solicita transferencia SPEI directo a tu cuenta mexicana con tu CLABE interbancaria de 18 dígitos.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-700">
            Monto a retirar (MXN)
          </label>
          <input
            type="number"
            min={50}
            max={Math.max(50, wallet.balanceMxn)}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="500"
            className="tabular-nums h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold outline-none focus:border-zinc-950 focus:bg-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-700">
            Banco
          </label>
          <input
            type="text"
            required
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            placeholder="BBVA, Nu, Santander..."
            className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none focus:border-zinc-950 focus:bg-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-zinc-700">
            CLABE (18 dígitos)
          </label>
          <input
            type="text"
            inputMode="numeric"
            required
            maxLength={18}
            value={clabe}
            onChange={(e) => setClabe(e.target.value.replace(/\D/g, "").slice(0, 18))}
            placeholder="012180001234567890"
            className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 font-mono text-xs outline-none focus:border-zinc-950 focus:bg-white"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || wallet.balanceMxn < 50}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-40"
      >
        <Building2 className="h-4 w-4" />
        {submitting
          ? "Enviando solicitud..."
          : wallet.balanceMxn < 50
            ? "Mínimo $50 MXN disponibles para retirar"
            : "Solicitar transferencia SPEI"}
      </button>
    </form>
  );
}

function CuentaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramTab = searchParams.get("tab") as TabId | null;
  const connectParam = searchParams.get("connect");
  const tab: TabId =
    paramTab &&
    ["perfil", "prendas", "ordenes", "billetera", "favoritos"].includes(paramTab)
      ? paramTab
      : "perfil";

  const { user, profile, loading: authLoading, refreshProfile, signOut } = useAuth();
  const { showToast } = useToast();

  const [myListings, setMyListings] = useState<ListingWithSeller[]>([]);
  const [purchases, setPurchases] = useState<OrderWithDetails[]>([]);
  const [sales, setSales] = useState<OrderWithDetails[]>([]);
  const [favListings, setFavListings] = useState<ListingWithSeller[]>([]);
  const [wallet, setWallet] = useState<WalletSnapshot>({
    balanceMxn: 0,
    pendingMxn: 0,
    stripeConnectAccountId: null,
    stripeConnectOnboarded: false,
    payoutClabe: null,
    payoutBank: null,
  });
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [startingConnect, setStartingConnect] = useState(false);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  const loadingData = Boolean(user && loadedUserId !== user.id);

  const fetchAccountData = useCallback(async () => {
    if (!user) return;
    const [listingsRes, ordersRes, favsRes, walletRes] = await Promise.all([
      fetch("/api/v1/listings?mine=true"),
      fetch("/api/v1/orders"),
      fetch("/api/v1/favorites"),
      fetch("/api/v1/wallet"),
    ]);

    if (listingsRes.ok) {
      const d = await listingsRes.json();
      setMyListings(d.listings ?? []);
    }
    if (ordersRes.ok) {
      const d = await ordersRes.json();
      setPurchases(d.purchases ?? []);
      setSales(d.sales ?? []);
    }
    if (favsRes.ok) {
      const d = await favsRes.json();
      setFavListings(d.listings ?? []);
    }
    if (walletRes.ok) {
      const d = await walletRes.json();
      if (d.wallet) setWallet(d.wallet);
      setTransactions(d.transactions ?? []);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const currentUserId = user.id;
    let active = true;

    async function initLoad() {
      try {
        if (connectParam === "return") {
          await fetch("/api/v1/connect/status");
        }
        await fetchAccountData();
      } finally {
        if (active) setLoadedUserId(currentUserId);
      }
    }

    initLoad();
    return () => {
      active = false;
    };
  }, [user, connectParam, fetchAccountData]);

  const handleReloadAll = async () => {
    await Promise.all([fetchAccountData(), refreshProfile()]);
  };

  const handleStripeConnectOnboard = async () => {
    setStartingConnect(true);
    try {
      const res = await fetch("/api/v1/connect/onboard", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) {
        showToast(data.error ?? "No se pudo conectar Stripe Express.", "error");
        return;
      }
      window.location.href = data.url;
    } catch {
      showToast("Error conectando con Stripe Express.", "error");
    } finally {
      setStartingConnect(false);
    }
  };

  const handleTogglePause = async (listing: ListingWithSeller) => {
    const nextStatus = listing.status === "paused" ? "active" : "paused";
    const res = await fetch(`/api/v1/listings/${listing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (res.ok) {
      setMyListings((prev) =>
        prev.map((item) =>
          item.id === listing.id ? { ...item, status: nextStatus } : item
        )
      );
      showToast(
        nextStatus === "paused" ? "Prenda pausada" : "Prenda reactivada",
        "success"
      );
    } else {
      showToast("No se pudo actualizar la prenda.", "error");
    }
  };

  const handleDeleteListing = async (listingId: string) => {
    const res = await fetch(`/api/v1/listings/${listingId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMyListings((prev) => prev.filter((item) => item.id !== listingId));
      showToast("Prenda eliminada", "success");
    } else {
      showToast(data.error ?? "No se pudo eliminar la prenda.", "error");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-3xl border border-zinc-200 bg-white p-10">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-white">
            <UserIcon className="h-6 w-6 text-emerald-400" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold text-zinc-950">
            Menú de Cuenta zibataWear
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Ingresa con tu código de 6 dígitos para administrar tu perfil, tus
            prendas publicadas, pagos en custodia y tu billetera.
          </p>
          <Link
            href="/auth?next=/cuenta"
            className="mt-6 inline-flex rounded-full bg-zinc-950 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Ingresar con código
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">
      {/* Account Hero Banner */}
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-zinc-200 bg-white p-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-lg font-bold text-white">
            {(profile?.full_name?.[0] || user?.email?.[0] || "Z").toUpperCase()}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-zinc-950">
                {profile?.full_name?.trim() || user?.email}
              </h1>
              {profile?.is_student_verified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Universitario verificado
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                  Comunidad Zibatá
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">
              {user?.email} · {profile?.campus_zone || "Campus Anáhuac Querétaro"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.replace("/cuenta?tab=billetera", { scroll: false })}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
          >
            <Wallet className="h-3.5 w-3.5 text-emerald-600" />
            <span className="tabular-nums">{formatMxn(wallet.balanceMxn)}</span>
          </button>
          <Link
            href="/publicar"
            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Publicar prenda
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1">
        {[
          { id: "perfil", label: "Mi Perfil", icon: UserIcon },
          {
            id: "prendas",
            label: `Mis Prendas (${myListings.length})`,
            icon: Sparkles,
          },
          {
            id: "ordenes",
            label: `Compras y Rentas (${purchases.length + sales.length})`,
            icon: ShoppingBag,
          },
          {
            id: "billetera",
            label: `Billetera (${formatMxn(wallet.balanceMxn)})`,
            icon: Wallet,
          },
          {
            id: "favoritos",
            label: `Favoritos (${favListings.length})`,
            icon: Heart,
          },
        ].map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                router.replace(`/cuenta?tab=${item.id}`, { scroll: false })
              }
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition sm:text-sm",
                active
                  ? "border-zinc-950 bg-zinc-950 text-white"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-950"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {tab === "perfil" && (
          <div className="max-w-2xl space-y-6">
            <ProfileEditorForm
              key={profile ? `${profile.id}-${profile.updated_at}` : "loading"}
              profile={profile}
              onSaved={refreshProfile}
            />
            <PasswordSecurityCard />
          </div>
        )}

        {tab === "prendas" && (
          <div className="space-y-4">
            {loadingData ? (
              <div className="h-40 animate-pulse rounded-3xl bg-zinc-200/70" />
            ) : myListings.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-12 text-center">
                <p className="text-base font-semibold text-zinc-950">
                  Aún no has publicado ropa
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  Sube tu primera prenda y deja que zibataWear te recomiende el precio ideal.
                </p>
                <Link
                  href="/publicar"
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white"
                >
                  <Plus className="h-4 w-4" />
                  Publicar prenda
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {myListings.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between rounded-3xl border border-zinc-200 bg-white p-4"
                  >
                    <div className="flex gap-3.5">
                      <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-2xl bg-zinc-100">
                        {item.images?.[0] && (
                          <Image
                            src={item.images[0]}
                            alt={item.title}
                            fill
                            sizes="90px"
                            className="object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                            item.status === "active"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-zinc-100 text-zinc-600"
                          )}
                        >
                          {item.status}
                        </span>
                        <Link
                          href={`/prenda/${item.id}`}
                          className="mt-1 block truncate text-sm font-semibold text-zinc-950 hover:underline"
                        >
                          {item.title}
                        </Link>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {item.brand} · Talla {item.size}
                        </p>
                        <p className="tabular-nums mt-1 text-sm font-bold text-zinc-950">
                          {item.sale_price_mxn ? formatMxn(item.sale_price_mxn) : ""}
                          {item.sale_price_mxn && item.rent_price_per_day_mxn ? " · " : ""}
                          {item.rent_price_per_day_mxn
                            ? `${formatMxn(item.rent_price_per_day_mxn)}/d`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-zinc-100 pt-3">
                      <button
                        type="button"
                        onClick={() => handleTogglePause(item)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        {item.status === "paused" ? (
                          <>
                            <PlayCircle className="h-3.5 w-3.5 text-emerald-600" />
                            Reactivar
                          </>
                        ) : (
                          <>
                            <PauseCircle className="h-3.5 w-3.5" />
                            Pausar
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteListing(item.id)}
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "ordenes" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-zinc-950">
                  Mis compras y rentas ({purchases.length})
                </h2>
                <span className="text-[11px] font-medium text-zinc-500">
                  Tu código protege cada entrega
                </span>
              </div>
              {purchases.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Todavía no has comprado o rentado ninguna prenda.
                </p>
              ) : (
                purchases.map((order) => (
                  <OrderEscrowCard
                    key={order.id}
                    order={order}
                    role="buyer"
                    onUpdated={handleReloadAll}
                  />
                ))
              )}
            </section>

            <section className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-zinc-950">
                  Mis ventas y rentas recibidas ({sales.length})
                </h2>
                <span className="text-[11px] font-medium text-emerald-700">
                  Ingresa el PIN para cobrar
                </span>
              </div>
              {sales.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Cuando otro estudiante compre o rente tu ropa aparecerá aquí.
                </p>
              ) : (
                sales.map((order) => (
                  <OrderEscrowCard
                    key={order.id}
                    order={order}
                    role="seller"
                    onUpdated={handleReloadAll}
                  />
                ))
              )}
            </section>
          </div>
        )}

        {tab === "billetera" && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-12">
              {/* Obsidian Balance Card */}
              <div className="rounded-3xl bg-zinc-950 p-6 text-white shadow-lg sm:p-8 lg:col-span-7">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-emerald-300">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Billetera y custodia zibataWear
                  </span>
                  <span className="font-mono text-xs text-zinc-400">
                    Comisión plataforma: {PLATFORM_FEE_PERCENT}% (mín. ${PLATFORM_FEE_MIN_MXN})
                  </span>
                </div>

                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-zinc-400">
                      Saldo disponible para retirar
                    </p>
                    <p className="tabular-nums mt-1 text-4xl font-bold tracking-tight text-white">
                      {formatMxn(wallet.balanceMxn)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-zinc-400">
                      En custodia (esperando código de entrega)
                    </p>
                    <p className="tabular-nums mt-1 text-2xl font-bold text-amber-300">
                      {formatMxn(wallet.pendingMxn)}
                    </p>
                  </div>
                </div>

                <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-relaxed text-zinc-400">
                  Recibes el 100% del precio de tu prenda justo cuando el comprador te dé su código de 6 dígitos en Zibatá (el comprador cubre la comisión de {PLATFORM_FEE_PERCENT}% o mín. ${PLATFORM_FEE_MIN_MXN} MXN al pagar).
                </p>
              </div>

              {/* Stripe Connect Express Setup Card */}
              <div className="flex flex-col justify-between rounded-3xl border border-zinc-200 bg-white p-6 lg:col-span-5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-semibold text-zinc-950">
                      Depósitos directos con Stripe Connect
                    </h3>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                        wallet.stripeConnectOnboarded
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-zinc-100 text-zinc-600"
                      )}
                    >
                      {wallet.stripeConnectOnboarded ? "Conectado" : "Pendiente"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                    Conecta tu cuenta bancaria en México mediante Stripe Connect Express para que cada vez que valides un código de entrega los fondos se transfieran automáticamente.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={startingConnect}
                  onClick={handleStripeConnectOnboard}
                  className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
                >
                  <ExternalLink className="h-4 w-4 text-emerald-400" />
                  {startingConnect
                    ? "Abriendo Stripe Express..."
                    : wallet.stripeConnectOnboarded
                      ? "Administrar cuenta Stripe Express"
                      : "Configurar depósitos con Stripe"}
                </button>
              </div>
            </div>

            <WalletWithdrawalForm
              key={`${wallet.balanceMxn}-${wallet.payoutClabe ?? ""}-${wallet.payoutBank ?? ""}`}
              wallet={wallet}
              onWithdrawn={handleReloadAll}
            />

            {/* Ledger History */}
            <section className="rounded-3xl border border-zinc-200 bg-white p-6">
              <h3 className="text-base font-semibold text-zinc-950">
                Historial de movimientos ({transactions.length})
              </h3>
              {transactions.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">
                  Aquí verás cada retención en custodia, liberación por código y retiro bancario.
                </p>
              ) : (
                <div className="mt-4 divide-y divide-zinc-100">
                  {transactions.map((tx) => {
                    const isPositive = tx.amount_mxn >= 0;
                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between gap-4 py-3 text-sm"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                              tx.status === "pending"
                                ? "bg-amber-50 text-amber-600"
                                : isPositive
                                  ? "bg-emerald-50 text-emerald-600"
                                  : "bg-zinc-100 text-zinc-700"
                            )}
                          >
                            {isPositive ? (
                              <ArrowDownLeft className="h-4 w-4" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-zinc-950">
                              {tx.description}
                            </p>
                            <p className="text-xs text-zinc-400">
                              {new Date(tx.created_at).toLocaleString("es-MX", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}{" "}
                              · {tx.status === "pending" ? "Pendiente" : "Completado"}
                            </p>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "tabular-nums shrink-0 font-mono text-sm font-bold",
                            tx.status === "pending"
                              ? "text-amber-600"
                              : isPositive
                                ? "text-emerald-700"
                                : "text-zinc-900"
                          )}
                        >
                          {isPositive ? "+" : ""}
                          {formatMxn(tx.amount_mxn)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {tab === "favoritos" && (
          <div>
            {favListings.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-zinc-300 bg-white p-12 text-center">
                <p className="text-base font-semibold text-zinc-950">
                  Aún no guardas favoritos
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  Toca el corazón en cualquier prenda del catálogo para guardarla aquí.
                </p>
                <Link
                  href="/"
                  className="mt-5 inline-flex rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Explorar prendas
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {favListings.map((item) => (
                  <ListingCard key={item.id} listing={item} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CuentaPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="h-40 animate-pulse rounded-3xl bg-zinc-200/70" />
        </div>
      }
    >
      <CuentaContent />
    </Suspense>
  );
}
