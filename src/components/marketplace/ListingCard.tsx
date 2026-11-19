"use client";

import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Heart, MapPin, Repeat } from "lucide-react";
import { CONDITION_MAP, formatMxn } from "@/core/constants/zibata";
import type { ListingWithSeller } from "@/core/types/domain";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { cn } from "@/lib/utils";

interface ListingCardProps {
  listing: ListingWithSeller;
}

export function ListingCard({ listing }: ListingCardProps) {
  const { favoriteIds, toggleFavorite } = useAuth();
  const { showToast } = useToast();
  const isFav = favoriteIds.has(listing.id);
  const coverImage =
    listing.images?.[0] ||
    "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=900&q=80";

  const conditionLabel = CONDITION_MAP[listing.condition]?.label ?? listing.condition;
  const canRent =
    (listing.listing_mode === "rent" || listing.listing_mode === "both") &&
    listing.rent_price_per_day_mxn;
  const canBuy =
    (listing.listing_mode === "buy" || listing.listing_mode === "both") &&
    listing.sale_price_mxn;

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const res = await toggleFavorite(listing.id);
    if (!res.ok && res.error) {
      showToast(res.error, "error");
    } else if (res.ok) {
      showToast(isFav ? "Quitado de favoritos" : "Guardado en tus favoritos", "success");
    }
  };

  return (
    <Link
      href={`/prenda/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white transition duration-300 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-100">
        <Image
          src={coverImage}
          alt={listing.title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover transition duration-500 group-hover:scale-105"
        />

        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {listing.listing_mode === "both" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-950/85 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
                Compra · Renta
              </span>
            ) : listing.listing_mode === "rent" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/90 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
                <Repeat className="h-3 w-3" />
                Solo renta
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-zinc-900 backdrop-blur-md">
                Compra
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleFavoriteClick}
            aria-label={isFav ? "Quitar de favoritos" : "Guardar en favoritos"}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-zinc-800 shadow-xs backdrop-blur-md transition hover:scale-105 hover:bg-white"
          >
            <Heart
              className={cn(
                "h-4 w-4 transition",
                isFav ? "fill-rose-500 text-rose-500" : "text-zinc-700"
              )}
            />
          </button>
        </div>

        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
            <MapPin className="h-3 w-3 text-emerald-400" />
            <span className="max-w-[140px] truncate">{listing.meetup_zone}</span>
          </span>
          <span className="rounded-full bg-white/90 px-2 py-0.5 font-mono text-[11px] font-semibold text-zinc-900 backdrop-blur-md">
            {listing.size}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between p-3.5 sm:p-4">
        <div>
          <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
            <span className="truncate font-medium uppercase tracking-wide text-zinc-500">
              {listing.brand}
            </span>
            <span className="shrink-0 text-[11px] text-zinc-400">{conditionLabel}</span>
          </div>
          <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-zinc-950 sm:text-[15px]">
            {listing.title}
          </h3>
        </div>

        <div className="mt-3 border-t border-zinc-100 pt-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
            {canBuy ? (
              <span className="tabular-nums text-base font-bold text-zinc-950">
                {formatMxn(listing.sale_price_mxn!)}
              </span>
            ) : (
              <span className="tabular-nums text-base font-bold text-emerald-700">
                {formatMxn(listing.rent_price_per_day_mxn!)}
                <span className="text-xs font-normal text-zinc-500"> /día</span>
              </span>
            )}

            {canBuy && canRent && (
              <span className="tabular-nums rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                Renta {formatMxn(listing.rent_price_per_day_mxn!)}/d
              </span>
            )}
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-800">
              {listing.seller?.full_name?.[0]?.toUpperCase() || "Z"}
            </span>
            <span className="truncate font-medium text-zinc-700">
              {listing.seller?.full_name || "Estudiante Zibatá"}
            </span>
            {listing.seller?.is_student_verified && (
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
