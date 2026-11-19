"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  BadgeCheck,
  Heart,
  LogOut,
  MapPin,
  PauseCircle,
  PlayCircle,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { formatMxn, ZIBATA_MEETUP_ZONES } from "@/core/constants/zibata";
import type { ListingWithSeller, OrderWithDetails, Profile } from "@/core/types/domain";
import { ListingCard } from "@/components/marketplace/ListingCard";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { cn } from "@/lib/utils";

type TabId = "perfil" | "prendas" | "ordenes" | "favoritos";

const STATUS_BADGE: Record<string, { label: string; tone: string }> = {
  pending: { label: "Pendiente", tone: "bg-amber-50 text-amber-700" },
  paid: { label: "Pagado con Stripe", tone: "bg-emerald-50 text-emerald-700" },
  demo_paid: { label: "Pago Demo Confirmado", tone: "bg-emerald-50 text-emerald-700" },
  active_rental: { label: "Renta Activa", tone: "bg-blue-50 text-blue-700" },
  completed: { label: "Completado", tone: "bg-zinc-100 text-zinc-700" },
  cancelled: { label: "Cancelado", tone: "bg-rose-50 text-rose-700" },
  refunded: { label: "Reembolsado", tone: "bg-zinc-100 text-zinc-700" },
};

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

function CuentaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramTab = searchParams.get("tab") as TabId | null;
  const tab: TabId =
    paramTab && ["perfil", "prendas", "ordenes", "favoritos"].includes(paramTab)
      ? paramTab
      : "perfil";

  const { user, profile, loading: authLoading, refreshProfile, signOut } = useAuth();
  const { showToast } = useToast();

  const [myListings, setMyListings] = useState<ListingWithSeller[]>([]);
  const [purchases, setPurchases] = useState<OrderWithDetails[]>([]);
  const [sales, setSales] = useState<OrderWithDetails[]>([]);
  const [favListings, setFavListings] = useState<ListingWithSeller[]>([]);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  const loadingData = Boolean(user && loadedUserId !== user.id);

  useEffect(() => {
    if (!user) return;
    const currentUserId = user.id;
    let active = true;

    async function fetchAccountData() {
      try {
        const [listingsRes, ordersRes, favsRes] = await Promise.all([
          fetch("/api/v1/listings?mine=true"),
          fetch("/api/v1/orders"),
          fetch("/api/v1/favorites"),
        ]);
        if (!active) return;

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
      } finally {
        if (active) setLoadedUserId(currentUserId);
      }
    }

    fetchAccountData();
    return () => {
      active = false;
    };
  }, [user]);

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
            prendas publicadas, compras, rentas y favoritos.
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

        <div className="flex flex-wrap gap-2">
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
          <ProfileEditorForm
            key={profile ? `${profile.id}-${profile.updated_at}` : "loading"}
            profile={profile}
            onSaved={refreshProfile}
          />
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
              <h2 className="text-base font-semibold text-zinc-950">
                Mis compras y rentas ({purchases.length})
              </h2>
              {purchases.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Todavía no has comprado o rentado ninguna prenda.
                </p>
              ) : (
                purchases.map((order) => {
                  const badge = STATUS_BADGE[order.status] ?? {
                    label: order.status,
                    tone: "bg-zinc-100 text-zinc-700",
                  };
                  return (
                    <div
                      key={order.id}
                      className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span
                            className={cn(
                              "inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                              badge.tone
                            )}
                          >
                            {badge.label}
                          </span>
                          <p className="mt-1.5 text-sm font-semibold text-zinc-950">
                            {order.listing?.title ?? "Prenda"}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
                            <MapPin className="h-3 w-3 text-emerald-600" />
                            {order.meetup_zone}
                            {order.order_type === "rent" && order.rental_start_date
                              ? ` · ${order.rental_start_date} a ${order.rental_end_date}`
                              : ""}
                          </p>
                        </div>
                        <span className="tabular-nums text-sm font-bold text-zinc-950">
                          {formatMxn(order.total_mxn)}
                        </span>
                      </div>

                      <div className="mt-3 flex gap-2">
                        {order.status === "pending" &&
                          order.payment_provider === "stripe_sandbox_demo" && (
                            <Link
                              href={`/pago/sandbox?orderId=${order.id}`}
                              className="rounded-full bg-zinc-950 px-3 py-1 text-xs font-semibold text-white"
                            >
                              Completar pago demo
                            </Link>
                          )}
                        <Link
                          href={`/pago/exito?orderId=${order.id}`}
                          className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700"
                        >
                          Ver recibo
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </section>

            <section className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-6">
              <h2 className="text-base font-semibold text-zinc-950">
                Mis ventas y rentas recibidas ({sales.length})
              </h2>
              {sales.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Cuando otro estudiante compre o rente tu ropa aparecerá aquí.
                </p>
              ) : (
                sales.map((order) => {
                  const badge = STATUS_BADGE[order.status] ?? {
                    label: order.status,
                    tone: "bg-zinc-100 text-zinc-700",
                  };
                  return (
                    <div
                      key={order.id}
                      className="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span
                            className={cn(
                              "inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                              badge.tone
                            )}
                          >
                            {badge.label}
                          </span>
                          <p className="mt-1.5 text-sm font-semibold text-zinc-950">
                            {order.listing?.title ?? "Prenda"}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            Comprador: {order.buyer?.full_name || "Estudiante Zibatá"} ·{" "}
                            {order.meetup_zone}
                          </p>
                        </div>
                        <span className="tabular-nums text-sm font-bold text-emerald-700">
                          +{formatMxn(order.subtotal_mxn)}
                        </span>
                      </div>
                    </div>
                  );
                })
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
