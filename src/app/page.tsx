import { createClient } from "@supabase/supabase-js";
import { cacheLife } from "next/cache";
import { Suspense } from "react";
import type { ListingWithSeller } from "@/core/types/domain";
import { PUBLIC_PROFILE_SELECT } from "@/lib/supabase/api-auth";
import { MarketplaceExplorer } from "@/components/marketplace/MarketplaceExplorer";

async function getInitialListings(): Promise<ListingWithSeller[]> {
  "use cache";
  cacheLife("minutes");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data } = await supabase
    .from("listings")
    .select(`*, seller:profiles!listings_seller_id_fkey(${PUBLIC_PROFILE_SELECT})`)
    .eq("status", "active")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(48);

  return (data ?? []) as ListingWithSeller[];
}

function ExplorerSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="h-64 animate-pulse rounded-3xl bg-zinc-200/70" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-zinc-200/60" />
        ))}
      </div>
    </div>
  );
}

export default async function HomePage() {
  const initialListings = await getInitialListings();

  return (
    <Suspense fallback={<ExplorerSkeleton />}>
      <MarketplaceExplorer initialListings={initialListings} />
    </Suspense>
  );
}
