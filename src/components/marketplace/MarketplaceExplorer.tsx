"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  X,
} from "lucide-react";
import {
  CATEGORIES,
  CLOTHING_SIZES,
  SNEAKER_SIZES,
  ZIBATA_MEETUP_ZONES,
} from "@/core/constants/zibata";
import type { ListingWithSeller } from "@/core/types/domain";
import { ListingCard } from "@/components/marketplace/ListingCard";
import { cn } from "@/lib/utils";

interface MarketplaceExplorerProps {
  initialListings: ListingWithSeller[];
}

export function MarketplaceExplorer({ initialListings }: MarketplaceExplorerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlMode = searchParams.get("mode");

  const [listings, setListings] = useState<ListingWithSeller[]>(initialListings);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const mode: "all" | "buy" | "rent" =
    urlMode === "buy" || urlMode === "rent" ? urlMode : "all";
  const [category, setCategory] = useState<string>("all");
  const [zone, setZone] = useState<string>("all");
  const [size, setSize] = useState<string>("all");
  const [priceRange, setPriceRange] = useState<"all" | "under_800" | "800_2000" | "over_2000">("all");
  const [sort, setSort] = useState<"recent" | "price_asc" | "price_desc">("recent");
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters =
    q.trim() !== "" ||
    mode !== "all" ||
    category !== "all" ||
    zone !== "all" ||
    size !== "all" ||
    sort !== "recent";

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (!hasActiveFilters) {
        setListings(initialListings);
        return;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        if (mode !== "all") params.set("mode", mode);
        if (category !== "all") params.set("category", category);
        if (zone !== "all") params.set("zone", zone);
        if (size !== "all") params.set("size", size);
        if (sort !== "recent") params.set("sort", sort);

        const res = await fetch(`/api/v1/listings?${params.toString()}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setListings(data.listings ?? []);
        }
      } catch {
        // Ignore aborted requests
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, mode, category, zone, size, sort, hasActiveFilters, initialListings]);

  const sizeOptions = useMemo(() => {
    if (category === "sneakers") return SNEAKER_SIZES;
    if (category === "accessories") return ["Única", "CH", "M", "G"];
    return [...CLOTHING_SIZES, ...SNEAKER_SIZES.slice(0, 5)];
  }, [category]);

  const handleModeChange = (nextMode: "all" | "buy" | "rent") => {
    if (nextMode === "all") router.replace("/", { scroll: false });
    else router.replace(`/?mode=${nextMode}`, { scroll: false });
  };

  const resetFilters = () => {
    setQ("");
    setCategory("all");
    setZone("all");
    setSize("all");
    setPriceRange("all");
    setSort("recent");
    handleModeChange("all");
  };

  const visibleListings = useMemo(() => {
    if (priceRange === "all") return listings;
    return listings.filter((item) => {
      const price = item.sale_price_mxn ?? item.rent_price_per_day_mxn ?? 0;
      if (priceRange === "under_800") return price < 800;
      if (priceRange === "800_2000") return price >= 800 && price <= 2000;
      return price > 2000;
    });
  }, [listings, priceRange]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-10">
      {/* Editorial Silicon Valley Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-10 lg:p-12">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-100/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-zinc-100 blur-3xl" />

        <div className="relative grid items-center gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Mercado universitario circular · Zibatá, Querétaro
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-5xl sm:leading-[1.06]">
              Tu clóset universitario en{" "}
              <span className="text-zinc-500">Zibatá.</span>
            </h1>

            <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-600 sm:text-lg">
              Compra, vende y renta ropa curada entre estudiantes de Campus Anáhuac
              y Zibatá. Con precio recomendado al instante, chat en vivo y pagos
              protegidos con Stripe.
            </p>

            {/* Quick search + mode pills */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Busca Nike, vestidos de gala, hoodies, Zara..."
                  className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50/70 pl-10 pr-4 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-950 focus:bg-white"
                />
              </div>

              <Link
                href="/publicar"
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
              >
                <Sparkles className="h-4 w-4 text-emerald-400" />
                Publicar prenda
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-zinc-600">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Custodia con código de 6 dígitos
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-zinc-700" />
                Entregas seguras en Campus y Zibatá
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4 text-emerald-600" />
                Comisión transparente del 7%
              </span>
            </div>
          </div>

          {/* Compact stats / smart recommendation highlight */}
          <div className="grid grid-cols-2 gap-3 lg:col-span-5">
            <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4">
              <p className="text-xs font-medium text-zinc-500">Modalidad dual</p>
              <p className="mt-1 text-xl font-semibold tracking-tight text-zinc-950">
                Compra o Renta
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                Renta vestidos o sneakers por día para eventos sin gastar de más.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-4">
              <p className="text-xs font-medium text-emerald-800">Motor de precios</p>
              <p className="tabular-nums mt-1 text-xl font-semibold tracking-tight text-emerald-950">
                Precio + Renta
              </p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-800/80">
                Te sugiere precio de venta, tarifa diaria, fianza y descripción.
              </p>
            </div>

            <div className="col-span-2 flex items-center justify-between gap-4 rounded-2xl border border-zinc-200/80 bg-white p-4">
              <div>
                <p className="text-xs font-medium text-zinc-500">
                  Puntos seguros en Zibatá
                </p>
                <p className="mt-0.5 text-sm font-semibold text-zinc-950">
                  Anáhuac · Xentric · Paseo Zibatá · Town Center
                </p>
              </div>
              <span className="tabular-nums shrink-0 rounded-full bg-zinc-950 px-3 py-1 font-mono text-xs font-medium text-white">
                {visibleListings.length} prendas
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Filter & Category Controls */}
      <section className="mt-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Mode Tabs */}
          <div className="inline-flex rounded-full border border-zinc-200 bg-white p-1 shadow-2xs">
            {[
              { id: "all", label: "Todo el clóset" },
              { id: "buy", label: "Para comprar" },
              { id: "rent", label: "Para rentar" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleModeChange(item.id as "all" | "buy" | "rent")}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-semibold transition sm:text-sm",
                  mode === item.id
                    ? "bg-zinc-950 text-white"
                    : "text-zinc-600 hover:text-zinc-950"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {(hasActiveFilters || priceRange !== "all") && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-950"
              >
                <X className="h-3.5 w-3.5" />
                Limpiar
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition sm:text-sm",
                showFilters
                  ? "border-zinc-950 bg-zinc-950 text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtros
            </button>
          </div>
        </div>

        {/* Scrollable Category Chips */}
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
              category === "all"
                ? "border-zinc-950 bg-zinc-950 text-white"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-950"
            )}
          >
            Todas las categorías
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
                category === cat.id
                  ? "border-zinc-950 bg-zinc-950 text-white"
                  : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-950"
              )}
            >
              {cat.shortLabel}
            </button>
          ))}
        </div>

        {showFilters && (
          <div className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                Punto de entrega en Zibatá
              </label>
              <select
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none focus:border-zinc-950"
              >
                <option value="all">Cualquier punto de Zibatá</option>
                {ZIBATA_MEETUP_ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                Talla
              </label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none focus:border-zinc-950"
              >
                <option value="all">Todas las tallas</option>
                {sizeOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                Rango de precio (MXN)
              </label>
              <select
                value={priceRange}
                onChange={(e) =>
                  setPriceRange(
                    e.target.value as "all" | "under_800" | "800_2000" | "over_2000"
                  )
                }
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none focus:border-zinc-950"
              >
                <option value="all">Cualquier precio</option>
                <option value="under_800">Menos de $800</option>
                <option value="800_2000">$800 – $2,000</option>
                <option value="over_2000">Más de $2,000</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-500">
                Ordenar por
              </label>
              <select
                value={sort}
                onChange={(e) =>
                  setSort(e.target.value as "recent" | "price_asc" | "price_desc")
                }
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none focus:border-zinc-950"
              >
                <option value="recent">Destacados y recientes</option>
                <option value="price_asc">Menor precio primero</option>
                <option value="price_desc">Mayor precio primero</option>
              </select>
            </div>
          </div>
        )}

        {(category !== "all" || zone !== "all" || size !== "all" || priceRange !== "all") && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {category !== "all" && (
              <button
                type="button"
                onClick={() => setCategory("all")}
                className="inline-flex items-center gap-1 rounded-full bg-zinc-950 px-3 py-1 font-medium text-white"
              >
                {CATEGORIES.find((c) => c.id === category)?.shortLabel ?? category}
                <X className="h-3 w-3" />
              </button>
            )}
            {zone !== "all" && (
              <button
                type="button"
                onClick={() => setZone("all")}
                className="inline-flex items-center gap-1 rounded-full bg-zinc-950 px-3 py-1 font-medium text-white"
              >
                {zone}
                <X className="h-3 w-3" />
              </button>
            )}
            {size !== "all" && (
              <button
                type="button"
                onClick={() => setSize("all")}
                className="inline-flex items-center gap-1 rounded-full bg-zinc-950 px-3 py-1 font-medium text-white"
              >
                Talla {size}
                <X className="h-3 w-3" />
              </button>
            )}
            {priceRange !== "all" && (
              <button
                type="button"
                onClick={() => setPriceRange("all")}
                className="inline-flex items-center gap-1 rounded-full bg-zinc-950 px-3 py-1 font-medium text-white"
              >
                {priceRange === "under_800"
                  ? "< $800"
                  : priceRange === "800_2000"
                    ? "$800 – $2,000"
                    : "$2,000+"}
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </section>

      {/* Catalog Grid */}
      <section className="mt-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
              >
                <div className="aspect-[4/5] animate-pulse bg-zinc-100" />
                <div className="space-y-2 p-4">
                  <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-100" />
                  <div className="h-4 w-4/5 animate-pulse rounded bg-zinc-100" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-100" />
                </div>
              </div>
            ))}
          </div>
        ) : visibleListings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
            <p className="text-base font-semibold text-zinc-950">
              No encontramos prendas con esos filtros
            </p>
            <p className="mt-1 max-w-md text-sm text-zinc-500">
              Prueba limpiando la búsqueda o publica esa pieza que estás buscando
              vender o rentar en Zibatá.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              >
                Ver todo el catálogo
              </button>
              <Link
                href="/publicar"
                className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Publicar prenda
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            {visibleListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>

      {/* How it works + Mobile Architecture Strip */}
      <section className="mt-16 grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-950 text-white">
            <Sparkles className="h-5 w-5 text-emerald-400" />
          </span>
          <h2 className="mt-4 text-base font-semibold text-zinc-950">
            1. Precio sugerido inteligente
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
            Sube tu prenda y nuestra calculadora recomienda precio óptimo de venta,
            tarifa de renta por día, depósito y descripción lista para publicar.
          </p>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-6">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-950 text-white">
            <MessageCircle className="h-5 w-5 text-emerald-400" />
          </span>
          <h2 className="mt-4 text-base font-semibold text-zinc-950">
            2. Chat directo y entrega en Zibatá
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
            Chatea en tiempo real para acordar talla, fecha de renta y entrega en
            Campus Anáhuac, Paseo Zibatá, Xentric o Town Center.
          </p>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-6">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-950 text-white">
            <Smartphone className="h-5 w-5 text-emerald-400" />
          </span>
          <h2 className="mt-4 text-base font-semibold text-zinc-950">
            3. Pagos Stripe & listo para App Móvil
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
            Arquitectura API-first compatible con iOS y Android, además de pasarela
            Stripe Checkout para compras y rentas seguras en MXN.
          </p>
        </div>
      </section>
    </div>
  );
}
