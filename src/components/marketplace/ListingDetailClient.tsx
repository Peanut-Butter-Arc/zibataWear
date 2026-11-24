"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Calendar,
  KeyRound,
  Lock,
  MapPin,
  MessageCircle,
  Repeat,
  Share2,
  ShoppingBag,
  Sparkles,
  Star,
} from "lucide-react";
import {
  calculateBuyerServiceFeeMxn,
  CATEGORY_MAP,
  CONDITION_MAP,
  formatMxn,
  PLATFORM_FEE_MIN_MXN,
  PLATFORM_FEE_PERCENT,
  PLATFORM_FEE_RATE,
  ZIBATA_MEETUP_ZONES,
} from "@/core/constants/zibata";
import type { ListingWithSeller } from "@/core/types/domain";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { cn } from "@/lib/utils";

function addDaysIso(baseDate: Date, days: number): string {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDaysInclusive(startStr: string, endStr: string): number {
  const start = new Date(`${startStr}T00:00:00Z`).getTime();
  const end = new Date(`${endStr}T00:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.floor((end - start) / 86_400_000) + 1;
}

export function ListingDetailClient({ listing }: { listing: ListingWithSeller }) {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();

  const canBuy =
    (listing.listing_mode === "buy" || listing.listing_mode === "both") &&
    Boolean(listing.sale_price_mxn);
  const canRent =
    (listing.listing_mode === "rent" || listing.listing_mode === "both") &&
    Boolean(listing.rent_price_per_day_mxn);

  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [selectedMode, setSelectedMode] = useState<"buy" | "rent">(
    canBuy ? "buy" : "rent"
  );
  const [meetupZone, setMeetupZone] = useState(listing.meetup_zone);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [rentalStartDate, setRentalStartDate] = useState(() => addDaysIso(new Date(), 1));
  const [rentalEndDate, setRentalEndDate] = useState(() => addDaysIso(new Date(), 3));

  const [submittingCheckout, setSubmittingCheckout] = useState(false);
  const [startingChat, setStartingChat] = useState(false);

  const images =
    listing.images && listing.images.length > 0
      ? listing.images
      : [
          "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=900&q=80",
        ];

  const rentalDays = useMemo(
    () => diffDaysInclusive(rentalStartDate, rentalEndDate),
    [rentalStartDate, rentalEndDate]
  );

  const pricingBreakdown = useMemo(() => {
    if (selectedMode === "buy") {
      const subtotal = listing.sale_price_mxn ?? 0;
      const fee = calculateBuyerServiceFeeMxn(subtotal);
      return {
        subtotal,
        deposit: 0,
        fee,
        isMinFeeApplied: fee > Math.round(subtotal * PLATFORM_FEE_RATE),
        total: subtotal + fee,
      };
    }

    const validDays = Math.max(1, rentalDays);
    const subtotal = (listing.rent_price_per_day_mxn ?? 0) * validDays;
    const deposit = listing.security_deposit_mxn ?? 0;
    const fee = calculateBuyerServiceFeeMxn(subtotal);
    return {
      subtotal,
      deposit,
      fee,
      isMinFeeApplied: fee > Math.round(subtotal * PLATFORM_FEE_RATE),
      total: subtotal + deposit + fee,
    };
  }, [selectedMode, listing, rentalDays]);

  const isOwner = user?.id === listing.seller_id;

  const applyQuickDays = (days: number) => {
    const start = rentalStartDate >= todayStr ? rentalStartDate : todayStr;
    setRentalStartDate(start);
    const startDateObj = new Date(`${start}T12:00:00Z`);
    setRentalEndDate(addDaysIso(startDateObj, days - 1));
  };

  const handleCheckout = async () => {
    if (!user) {
      router.push(`/auth?next=${encodeURIComponent(`/prenda/${listing.id}`)}`);
      return;
    }

    if (selectedMode === "rent" && (rentalDays < 1 || rentalDays > 30)) {
      showToast("Selecciona un rango de fechas válido (1 a 30 días).", "error");
      return;
    }

    setSubmittingCheckout(true);
    try {
      const res = await fetch("/api/v1/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
          orderType: selectedMode,
          rentalStartDate: selectedMode === "rent" ? rentalStartDate : undefined,
          rentalEndDate: selectedMode === "rent" ? rentalEndDate : undefined,
          meetupZone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "No pudimos iniciar el pago.", "error");
        return;
      }

      if (data.checkoutUrl) {
        if (String(data.checkoutUrl).startsWith("http")) {
          window.location.href = data.checkoutUrl;
        } else {
          router.push(data.checkoutUrl);
        }
      }
    } catch {
      showToast("Error de red al conectar con pagos.", "error");
    } finally {
      setSubmittingCheckout(false);
    }
  };

  const handleStartChat = async () => {
    if (!user) {
      router.push(`/auth?next=${encodeURIComponent(`/prenda/${listing.id}`)}`);
      return;
    }

    setStartingChat(true);
    try {
      const res = await fetch("/api/v1/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: listing.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "No pudimos abrir el chat.", "error");
        return;
      }
      router.push(`/chat?id=${data.conversation.id}`);
    } catch {
      showToast("Error al abrir el chat.", "error");
    } finally {
      setStartingChat(false);
    }
  };

  const handleShare = async () => {
    try {
      const shareUrl = typeof window !== "undefined" ? window.location.href : "";
      if (navigator.share && shareUrl) {
        await navigator.share({ title: listing.title, url: shareUrl });
      } else if (shareUrl) {
        await navigator.clipboard.writeText(shareUrl);
        showToast("Enlace copiado para compartir", "success");
      }
    } catch {
      // User dismissed share sheet
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 transition hover:text-zinc-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al catálogo
        </Link>

        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-950"
        >
          <Share2 className="h-3.5 w-3.5" />
          Compartir
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
        {/* Left: Photo Gallery + Garment Story */}
        <div className="space-y-4 lg:col-span-7">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-zinc-200 bg-zinc-100">
            <Image
              src={images[selectedImageIdx] ?? images[0]}
              alt={listing.title}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover"
            />
          </div>

          {images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {images.map((img, idx) => (
                <button
                  key={`${img}-${idx}`}
                  type="button"
                  onClick={() => setSelectedImageIdx(idx)}
                  className={cn(
                    "relative h-20 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition",
                    selectedImageIdx === idx
                      ? "border-zinc-950"
                      : "border-transparent opacity-70 hover:opacity-100"
                  )}
                >
                  <Image
                    src={img}
                    alt={`${listing.title} foto ${idx + 1}`}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Specs & Description */}
          <div className="rounded-3xl border border-zinc-200 bg-white p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Detalles de la prenda
            </h2>
            <p className="mt-3 text-base leading-relaxed text-zinc-700">
              {listing.description}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-zinc-50 p-3.5">
                <p className="text-[11px] font-medium uppercase text-zinc-400">Marca</p>
                <p className="mt-0.5 text-sm font-semibold text-zinc-950">
                  {listing.brand}
                </p>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-3.5">
                <p className="text-[11px] font-medium uppercase text-zinc-400">Talla</p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-zinc-950">
                  {listing.size}
                </p>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-3.5">
                <p className="text-[11px] font-medium uppercase text-zinc-400">
                  Condición
                </p>
                <p className="mt-0.5 text-sm font-semibold text-zinc-950">
                  {CONDITION_MAP[listing.condition]?.label ?? listing.condition}
                </p>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-3.5">
                <p className="text-[11px] font-medium uppercase text-zinc-400">
                  Categoría
                </p>
                <p className="mt-0.5 text-sm font-semibold text-zinc-950">
                  {CATEGORY_MAP[listing.category]?.shortLabel ?? listing.category}
                </p>
              </div>
            </div>

            {listing.recommended_sale_price_mxn && (
              <div className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-900">
                <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  Valor de mercado sugerido en Zibatá:{" "}
                  <strong className="tabular-nums">
                    {formatMxn(listing.recommended_sale_price_mxn)}
                  </strong>
                  {listing.original_price_mxn ? (
                    <>
                      {" "}
                      · Retail aprox.{" "}
                      <span className="tabular-nums line-through">
                        {formatMxn(listing.original_price_mxn)}
                      </span>
                    </>
                  ) : null}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Sticky Silicon Valley Checkout & Seller Card */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:col-span-5">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {listing.brand}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                <MapPin className="h-3 w-3 text-emerald-600" />
                {listing.meetup_zone}
              </span>
            </div>

            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
              {listing.title}
            </h1>

            {/* Buy / Rent Switcher */}
            {canBuy && canRent && (
              <div className="mt-5 grid grid-cols-2 rounded-2xl border border-zinc-200 bg-zinc-100/80 p-1">
                <button
                  type="button"
                  onClick={() => setSelectedMode("buy")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition",
                    selectedMode === "buy"
                      ? "bg-white text-zinc-950 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-950"
                  )}
                >
                  <ShoppingBag className="h-4 w-4" />
                  Comprar · {formatMxn(listing.sale_price_mxn!)}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMode("rent")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition",
                    selectedMode === "rent"
                      ? "bg-white text-emerald-700 shadow-xs"
                      : "text-zinc-500 hover:text-zinc-950"
                  )}
                >
                  <Repeat className="h-4 w-4" />
                  Rentar · {formatMxn(listing.rent_price_per_day_mxn!)}/d
                </button>
              </div>
            )}

            {/* Price Header */}
            <div className="mt-5 flex items-baseline justify-between border-b border-zinc-100 pb-4">
              {selectedMode === "buy" ? (
                <div>
                  <p className="text-xs text-zinc-500">Precio de compra</p>
                  <p className="tabular-nums text-3xl font-bold tracking-tight text-zinc-950">
                    {formatMxn(listing.sale_price_mxn ?? 0)}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-emerald-700">Tarifa de renta por día</p>
                  <p className="tabular-nums text-3xl font-bold tracking-tight text-emerald-700">
                    {formatMxn(listing.rent_price_per_day_mxn ?? 0)}
                    <span className="text-base font-normal text-zinc-500"> /día</span>
                  </p>
                </div>
              )}

              <span className="rounded-full bg-zinc-100 px-3 py-1 font-mono text-xs font-semibold text-zinc-800">
                Talla {listing.size}
              </span>
            </div>

            {/* Rent Date Picker */}
            {selectedMode === "rent" && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
                    <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                    Fechas de renta
                  </span>
                  <div className="flex gap-1.5">
                    {[1, 3, 7].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => applyQuickDays(days)}
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition",
                          rentalDays === days
                            ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                            : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
                        )}
                      >
                        {days} {days === 1 ? "día" : "días"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-zinc-500">
                      Entrega
                    </label>
                    <input
                      type="date"
                      min={todayStr}
                      value={rentalStartDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRentalStartDate(val);
                        if (val > rentalEndDate) setRentalEndDate(val);
                      }}
                      className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-medium text-zinc-900 outline-none focus:border-zinc-950"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-zinc-500">
                      Devolución
                    </label>
                    <input
                      type="date"
                      min={rentalStartDate || todayStr}
                      value={rentalEndDate}
                      onChange={(e) => setRentalEndDate(e.target.value)}
                      className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-medium text-zinc-900 outline-none focus:border-zinc-950"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Meetup Zone */}
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-zinc-600">
                Punto de entrega en Zibatá
              </label>
              <select
                value={meetupZone}
                onChange={(e) => setMeetupZone(e.target.value)}
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none focus:border-zinc-950"
              >
                {ZIBATA_MEETUP_ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>

            {/* Breakdown */}
            <div className="mt-5 space-y-2 rounded-2xl bg-zinc-50 p-4 text-sm">
              <div className="flex justify-between text-zinc-600">
                <span>
                  {selectedMode === "buy"
                    ? "Precio de la prenda"
                    : `Renta (${Math.max(1, rentalDays)} ${
                        rentalDays === 1 ? "día" : "días"
                      })`}
                </span>
                <span className="tabular-nums font-medium text-zinc-900">
                  {formatMxn(pricingBreakdown.subtotal)}
                </span>
              </div>

              {selectedMode === "rent" && pricingBreakdown.deposit > 0 && (
                <div className="flex justify-between text-zinc-600">
                  <span>Fianza reembolsable</span>
                  <span className="tabular-nums font-medium text-zinc-900">
                    {formatMxn(pricingBreakdown.deposit)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-zinc-600">
                <span>
                  Comisión y Protección zibataWear ({PLATFORM_FEE_PERCENT}%
                  {pricingBreakdown.isMinFeeApplied
                    ? ` · mín. $${PLATFORM_FEE_MIN_MXN}`
                    : ""}
                  )
                </span>
                <span className="tabular-nums font-medium text-zinc-900">
                  {formatMxn(pricingBreakdown.fee)}
                </span>
              </div>

              <div className="flex justify-between border-t border-zinc-200 pt-2.5 text-base font-semibold text-zinc-950">
                <span>Total a pagar</span>
                <span className="tabular-nums">{formatMxn(pricingBreakdown.total)}</span>
              </div>
            </div>

            {/* Primary CTAs */}
            <div className="mt-5 space-y-2.5">
              {isOwner ? (
                <Link
                  href="/cuenta?tab=prendas"
                  className="flex h-12 w-full items-center justify-center rounded-2xl bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800"
                >
                  Administrar mi prenda
                </Link>
              ) : listing.status !== "active" ? (
                <div className="rounded-2xl border border-zinc-200 bg-zinc-100 py-3 text-center text-sm font-medium text-zinc-600">
                  Prenda actualmente no disponible ({listing.status})
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={submittingCheckout}
                    onClick={handleCheckout}
                    className={cn(
                      "flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white shadow-sm transition disabled:opacity-60",
                      selectedMode === "rent"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : "bg-zinc-950 hover:bg-zinc-800"
                    )}
                  >
                    <Lock className="h-4 w-4" />
                    {submittingCheckout
                      ? "Preparando checkout..."
                      : selectedMode === "buy"
                        ? `Comprar ahora · ${formatMxn(pricingBreakdown.total)}`
                        : `Rentar con Stripe · ${formatMxn(pricingBreakdown.total)}`}
                  </button>

                  <button
                    type="button"
                    disabled={startingChat}
                    onClick={handleStartChat}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-60"
                  >
                    <MessageCircle className="h-4 w-4" />
                    {startingChat
                      ? "Abriendo conversación..."
                      : "Chatear con el vendedor"}
                  </button>
                </>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-3.5 text-xs text-emerald-950">
              <p className="flex items-center gap-1.5 font-semibold text-emerald-900">
                <KeyRound className="h-3.5 w-3.5 text-emerald-600" />
                Custodia segura con código de 6 dígitos
              </p>
              <p className="mt-1 leading-relaxed text-emerald-800">
                Tu pago se retiene en zibataWear y <strong>solo se deposita al vendedor</strong> cuando confirmes el código de entrega en {meetupZone}.
              </p>
            </div>
          </div>

          {/* Seller Card */}
          <div className="rounded-3xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-base font-bold text-white">
                {listing.seller?.full_name?.[0]?.toUpperCase() || "Z"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-semibold text-zinc-950">
                    {listing.seller?.full_name || "Estudiante Zibatá"}
                  </p>
                  {listing.seller?.is_student_verified && (
                    <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                  )}
                </div>
                <p className="truncate text-xs text-zinc-500">
                  {listing.seller?.university || "Universidad Anáhuac Querétaro"}
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-900">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {Number(listing.seller?.rating ?? 5).toFixed(1)}
              </div>
            </div>
            {listing.seller?.bio && (
              <p className="mt-3 text-xs leading-relaxed text-zinc-600">
                {listing.seller.bio}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
