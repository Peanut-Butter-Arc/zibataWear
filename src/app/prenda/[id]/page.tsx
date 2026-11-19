import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import type { ListingWithSeller } from "@/core/types/domain";
import { ListingDetailClient } from "@/components/marketplace/ListingDetailClient";

const getListingById = cache(async (id: string): Promise<ListingWithSeller | null> => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data } = await supabase
    .from("listings")
    .select("*, seller:profiles!listings_seller_id_fkey(*)")
    .eq("id", id)
    .maybeSingle();

  return (data as ListingWithSeller | null) ?? null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListingById(id);

  if (!listing) {
    return { title: "Prenda no encontrada" };
  }

  return {
    title: `${listing.title} (${listing.brand})`,
    description: listing.description,
  };
}

async function ListingDetailLoader({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await getListingById(id);

  if (!listing) {
    notFound();
  }

  return <ListingDetailClient listing={listing} />;
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="aspect-[4/5] animate-pulse rounded-3xl bg-zinc-200/70 lg:col-span-7" />
        <div className="h-96 animate-pulse rounded-3xl bg-zinc-200/70 lg:col-span-5" />
      </div>
    </div>
  );
}

export default function PrendaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <ListingDetailLoader params={params} />
    </Suspense>
  );
}
