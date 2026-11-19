"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  ArrowRight,
  Check,
  ImagePlus,
  Loader2,
  MapPin,
  Sparkles,
  TrendingUp,
  Wand2,
  X,
} from "lucide-react";
import {
  CATEGORIES,
  CONDITIONS,
  formatMxn,
  POPULAR_BRANDS,
  SIZES_BY_CATEGORY,
  ZIBATA_MEETUP_ZONES,
  type CategoryId,
  type ConditionId,
  type ListingMode,
} from "@/core/constants/zibata";
import { recommendClothingPricing } from "@/core/pricing/engine";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { cn } from "@/lib/utils";

const DRAFT_KEY = "zibatawear_publish_draft_v1";

interface DraftState {
  category: CategoryId;
  brand: string;
  size: string;
  condition: ConditionId;
  listingMode: ListingMode;
  originalPrice: string;
  salePrice: string;
  rentPrice: string;
  securityDeposit: string;
  meetupZone: string;
  title: string;
  description: string;
  images: string[];
}

const DEFAULT_DRAFT: DraftState = {
  category: "hoodies",
  brand: "Nike",
  size: "M",
  condition: "like_new",
  listingMode: "both",
  originalPrice: "2199",
  salePrice: "980",
  rentPrice: "140",
  securityDeposit: "400",
  meetupZone: ZIBATA_MEETUP_ZONES[0],
  title: "",
  description: "",
  images: [],
};

function readSavedDraft(): DraftState {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return DEFAULT_DRAFT;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_DRAFT,
      ...parsed,
      images: Array.isArray(parsed.images) ? parsed.images : [],
    };
  } catch {
    return DEFAULT_DRAFT;
  }
}

function saveDraft(draft: DraftState) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Ignore storage errors
  }
}

const emptySubscribe = () => () => {};

function PublishStudioForm({ initialDraft }: { initialDraft: DraftState }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [form, setForm] = useState<DraftState>(initialDraft);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const updateForm = (updater: Partial<DraftState> | ((prev: DraftState) => DraftState)) => {
    setForm((prev) => {
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      saveDraft(next);
      return next;
    });
  };

  const availableSizes = SIZES_BY_CATEGORY[form.category];

  const handleCategoryChange = (nextCategory: CategoryId) => {
    const nextSizes = SIZES_BY_CATEGORY[nextCategory];
    const nextSize = nextSizes.includes(form.size)
      ? form.size
      : nextSizes[Math.min(2, nextSizes.length - 1)] ?? nextSizes[0];
    updateForm({ category: nextCategory, size: nextSize });
  };

  const recommendation = useMemo(() => {
    const parsedOriginal = Number(form.originalPrice);
    return recommendClothingPricing({
      category: form.category,
      brand: form.brand,
      condition: form.condition,
      size: form.size,
      originalPriceMxn:
        Number.isFinite(parsedOriginal) && parsedOriginal >= 100
          ? Math.round(parsedOriginal)
          : null,
      meetupZone: form.meetupZone,
      listingMode: form.listingMode,
    });
  }, [
    form.category,
    form.brand,
    form.condition,
    form.size,
    form.originalPrice,
    form.meetupZone,
    form.listingMode,
  ]);

  const applyRecommendedPrices = () => {
    updateForm({
      salePrice: String(recommendation.recommendedSalePriceMxn),
      rentPrice: String(recommendation.recommendedRentPerDayMxn),
      securityDeposit: String(recommendation.recommendedDepositMxn),
    });
    showToast("Precios y depósito recomendados aplicados", "success");
  };

  const applyRecommendedCopy = () => {
    updateForm({
      title: recommendation.suggestedTitle,
      description: recommendation.suggestedDescription,
    });
    showToast("Título y descripción sugeridos aplicados", "success");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!user) {
      showToast("Inicia sesión con tu código para subir fotos reales.", "error");
      router.push("/auth?next=/publicar");
      return;
    }

    if (form.images.length + files.length > 6) {
      showToast("Máximo 6 fotos por prenda.", "error");
      return;
    }

    setUploadingImage(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/v1/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error ?? "No se pudo subir una imagen.", "error");
        } else if (data.url) {
          uploadedUrls.push(data.url);
        }
      }
      if (uploadedUrls.length > 0) {
        updateForm((prev) => ({
          ...prev,
          images: [...prev.images, ...uploadedUrls].slice(0, 6),
        }));
        showToast(`${uploadedUrls.length} foto(s) lista(s)`, "success");
      }
    } catch {
      showToast("Error subiendo imagen.", "error");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const removeImage = (idx: number) => {
    updateForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== idx),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast("Inicia sesión con tu código de 6 dígitos para publicar.", "info");
      router.push("/auth?next=/publicar");
      return;
    }

    if (form.images.length === 0) {
      showToast("Sube al menos 1 foto de tu prenda.", "error");
      return;
    }

    const finalTitle = form.title.trim() || recommendation.suggestedTitle;
    const finalDescription =
      form.description.trim() || recommendation.suggestedDescription;

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: finalTitle,
          description: finalDescription,
          brand: form.brand.trim(),
          category: form.category,
          size: form.size,
          condition: form.condition,
          listing_mode: form.listingMode,
          sale_price_mxn:
            form.listingMode === "rent"
              ? null
              : Number(form.salePrice) || recommendation.recommendedSalePriceMxn,
          rent_price_per_day_mxn:
            form.listingMode === "buy"
              ? null
              : Number(form.rentPrice) || recommendation.recommendedRentPerDayMxn,
          security_deposit_mxn:
            form.listingMode === "buy" ? 0 : Number(form.securityDeposit) || 0,
          original_price_mxn:
            Number(form.originalPrice) >= 100
              ? Math.round(Number(form.originalPrice))
              : null,
          recommended_sale_price_mxn: recommendation.recommendedSalePriceMxn,
          recommended_rent_price_mxn: recommendation.recommendedRentPerDayMxn,
          meetup_zone: form.meetupZone,
          images: form.images,
          tags: [form.category, form.brand.toLowerCase()],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "No pudimos publicar la prenda.", "error");
        return;
      }

      sessionStorage.removeItem(DRAFT_KEY);
      showToast("¡Prenda publicada en zibataWear!", "success");
      router.push(`/prenda/${data.listing.id}`);
    } catch {
      showToast("Error de red al publicar.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <Sparkles className="h-3.5 w-3.5" />
            Estudio inteligente de publicación
          </span>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
            Vende o renta tu ropa en Zibatá
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Calculamos el precio ideal de venta, tarifa diaria de renta, depósito y
            descripción automática en tiempo real.
          </p>
        </div>

        {!authLoading && !user && (
          <Link
            href="/auth?next=/publicar"
            className="inline-flex items-center gap-2 rounded-2xl border border-zinc-950 bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-zinc-800"
          >
            Verificar cuenta con código antes de publicar
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-12 lg:items-start">
        <div className="space-y-6 lg:col-span-7">
          {/* Photos */}
          <section className="rounded-3xl border border-zinc-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-950">
                1. Fotos de la prenda
              </h2>
              <span className="font-mono text-xs text-zinc-500">
                {form.images.length}/6
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Sube entre 1 y 6 fotos nítidas con buena luz natural (máx. 5 MB c/u).
            </p>

            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {form.images.map((url, idx) => (
                <div
                  key={`${url}-${idx}`}
                  className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100"
                >
                  <Image
                    src={url}
                    alt={`Foto ${idx + 1}`}
                    fill
                    sizes="180px"
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    aria-label="Eliminar foto"
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  {idx === 0 && (
                    <span className="absolute bottom-1.5 left-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-zinc-950">
                      Portada
                    </span>
                  )}
                </div>
              ))}

              {form.images.length < 6 && (
                <label className="flex aspect-[4/5] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 text-center text-xs font-medium text-zinc-600 transition hover:border-zinc-950 hover:bg-zinc-100">
                  {uploadingImage ? (
                    <Loader2 className="h-5 w-5 animate-spin text-zinc-700" />
                  ) : (
                    <ImagePlus className="h-5 w-5 text-zinc-700" />
                  )}
                  <span>{uploadingImage ? "Subiendo..." : "Agregar foto"}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    multiple
                    disabled={uploadingImage}
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </section>

          {/* Basics */}
          <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6">
            <h2 className="text-base font-semibold text-zinc-950">
              2. Datos de la pieza
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Categoría
                </label>
                <select
                  value={form.category}
                  onChange={(e) => handleCategoryChange(e.target.value as CategoryId)}
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none focus:border-zinc-950 focus:bg-white"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Marca
                </label>
                <input
                  list="zibata-brands"
                  value={form.brand}
                  onChange={(e) => updateForm({ brand: e.target.value })}
                  placeholder="Ej. Nike, Zara, Sandro, Coach"
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none focus:border-zinc-950 focus:bg-white"
                />
                <datalist id="zibata-brands">
                  {POPULAR_BRANDS.map((b) => (
                    <option key={b.name} value={b.name} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Talla
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {availableSizes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => updateForm({ size: s })}
                      className={cn(
                        "rounded-xl border px-3 py-1.5 font-mono text-xs font-semibold transition",
                        form.size === s
                          ? "border-zinc-950 bg-zinc-950 text-white"
                          : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                  Precio original aprox. en tienda (MXN, opcional)
                </label>
                <input
                  type="number"
                  min={100}
                  max={200000}
                  value={form.originalPrice}
                  onChange={(e) => updateForm({ originalPrice: e.target.value })}
                  placeholder="Ej. 2400"
                  className="tabular-nums h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none focus:border-zinc-950 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Estado de la prenda
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {CONDITIONS.map((cond) => (
                  <button
                    key={cond.id}
                    type="button"
                    onClick={() => updateForm({ condition: cond.id })}
                    className={cn(
                      "rounded-2xl border p-3 text-left transition",
                      form.condition === cond.id
                        ? "border-zinc-950 bg-zinc-950 text-white"
                        : "border-zinc-200 bg-zinc-50 text-zinc-800 hover:border-zinc-300"
                    )}
                  >
                    <p className="text-xs font-semibold">{cond.label}</p>
                    <p
                      className={cn(
                        "mt-0.5 text-[11px]",
                        form.condition === cond.id ? "text-zinc-300" : "text-zinc-500"
                      )}
                    >
                      {cond.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Pricing & Mode */}
          <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-zinc-950">
                3. Modalidad y precios (MXN)
              </h2>
              <button
                type="button"
                onClick={applyRecommendedPrices}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Aplicar sugeridos
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "buy", label: "Solo venta" },
                { id: "rent", label: "Solo renta" },
                { id: "both", label: "Venta y renta" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => updateForm({ listingMode: m.id as ListingMode })}
                  className={cn(
                    "rounded-xl border py-2.5 text-xs font-semibold transition sm:text-sm",
                    form.listingMode === m.id
                      ? "border-zinc-950 bg-zinc-950 text-white"
                      : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {form.listingMode !== "rent" && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                    Precio de venta ($)
                  </label>
                  <input
                    type="number"
                    min={50}
                    required
                    value={form.salePrice}
                    onChange={(e) => updateForm({ salePrice: e.target.value })}
                    className="tabular-nums h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold outline-none focus:border-zinc-950 focus:bg-white"
                  />
                </div>
              )}

              {form.listingMode !== "buy" && (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                      Renta por día ($)
                    </label>
                    <input
                      type="number"
                      min={40}
                      required
                      value={form.rentPrice}
                      onChange={(e) => updateForm({ rentPrice: e.target.value })}
                      className="tabular-nums h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold text-emerald-700 outline-none focus:border-zinc-950 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                      Depósito reembolsable ($)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.securityDeposit}
                      onChange={(e) => updateForm({ securityDeposit: e.target.value })}
                      className="tabular-nums h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold outline-none focus:border-zinc-950 focus:bg-white"
                    />
                  </div>
                </>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Punto de entrega en Zibatá
              </label>
              <select
                value={form.meetupZone}
                onChange={(e) => updateForm({ meetupZone: e.target.value })}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none focus:border-zinc-950 focus:bg-white"
              >
                {ZIBATA_MEETUP_ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* Title & Description */}
          <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-zinc-950">
                4. Título y descripción
              </h2>
              <button
                type="button"
                onClick={applyRecommendedCopy}
                className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-200"
              >
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                Autocompletar texto sugerido
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Título del anuncio
              </label>
              <input
                type="text"
                required
                minLength={4}
                maxLength={90}
                value={form.title}
                onChange={(e) => updateForm({ title: e.target.value })}
                placeholder={recommendation.suggestedTitle}
                className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 text-sm outline-none focus:border-zinc-950 focus:bg-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-zinc-700">
                Descripción
              </label>
              <textarea
                rows={4}
                required
                minLength={10}
                maxLength={1200}
                value={form.description}
                onChange={(e) => updateForm({ description: e.target.value })}
                placeholder={recommendation.suggestedDescription}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-sm outline-none focus:border-zinc-950 focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || uploadingImage}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60"
            >
              {submitting ? "Publicando en Zibatá..." : "Publicar prenda en zibataWear"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </section>
        </div>

        {/* Right: Sticky Smart Recommendation Studio */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:col-span-5">
          <div className="rounded-3xl border border-zinc-200 bg-zinc-950 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" />
                Recomendación zibataWear
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-xs text-emerald-300">
                <TrendingUp className="h-3.5 w-3.5" />
                Demanda {recommendation.demandScore}/100
              </span>
            </div>

            <p className="mt-2 text-xs text-zinc-400">{recommendation.demandLabel}</p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  Venta recomendada
                </p>
                <p className="tabular-nums mt-1 text-2xl font-bold text-white">
                  {formatMxn(recommendation.recommendedSalePriceMxn)}
                </p>
                <p className="mt-1 text-[11px] text-zinc-400">
                  Rápida: {formatMxn(recommendation.quickSalePriceMxn)} · Máx:{" "}
                  {formatMxn(recommendation.maxMarketPriceMxn)}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-300">
                  Renta diaria ideal
                </p>
                <p className="tabular-nums mt-1 text-2xl font-bold text-emerald-300">
                  {formatMxn(recommendation.recommendedRentPerDayMxn)}
                  <span className="text-xs font-normal">/día</span>
                </p>
                <p className="mt-1 text-[11px] text-emerald-200/80">
                  Fin (3d): {formatMxn(recommendation.recommendedWeekendPackMxn)} ·
                  Fianza: {formatMxn(recommendation.recommendedDepositMxn)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={applyRecommendedPrices}
              className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-400"
            >
              <Check className="h-4 w-4" />
              Aplicar precios recomendados
            </button>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-zinc-200">
                  Título y descripción recomendados
                </p>
                <button
                  type="button"
                  onClick={applyRecommendedCopy}
                  className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white hover:bg-white/20"
                >
                  Usar texto
                </button>
              </div>
              <p className="mt-2 text-xs font-semibold text-white">
                {recommendation.suggestedTitle}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-300">
                {recommendation.suggestedDescription}
              </p>
            </div>

            <ul className="mt-4 space-y-2 border-t border-white/10 pt-4 text-xs text-zinc-300">
              {recommendation.insights.map((line, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Vista previa en el feed
            </p>
            <div className="flex items-center gap-4">
              <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-2xl bg-zinc-100">
                {form.images[0] ? (
                  <Image
                    src={form.images[0]}
                    alt="Preview"
                    fill
                    sizes="90px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] text-zinc-400">
                    Sin foto
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase text-zinc-400">
                  {form.brand || "Marca"} · {form.size}
                </p>
                <p className="truncate text-sm font-semibold text-zinc-950">
                  {form.title.trim() || recommendation.suggestedTitle}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {form.listingMode !== "rent" && (
                    <span className="tabular-nums text-sm font-bold text-zinc-950">
                      {formatMxn(
                        Number(form.salePrice) || recommendation.recommendedSalePriceMxn
                      )}
                    </span>
                  )}
                  {form.listingMode !== "buy" && (
                    <span className="tabular-nums rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      Renta{" "}
                      {formatMxn(
                        Number(form.rentPrice) || recommendation.recommendedRentPerDayMxn
                      )}
                      /d
                    </span>
                  )}
                </div>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-zinc-500">
                  <MapPin className="h-3 w-3 text-emerald-600" />
                  {form.meetupZone}
                </p>
              </div>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}

export default function PublicarPage() {
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="h-96 animate-pulse rounded-3xl bg-zinc-200/70" />
      </div>
    );
  }

  return <PublishStudioForm initialDraft={readSavedDraft()} />;
}
