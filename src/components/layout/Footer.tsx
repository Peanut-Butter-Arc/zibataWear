import Link from "next/link";
import { ShieldCheck, Smartphone, Sparkles } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white pb-24 pt-12 md:pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-950 text-sm font-bold text-white">
                zW
              </span>
              <span className="text-lg font-semibold tracking-tight text-zinc-950">
                zibataWear
              </span>
            </div>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-600">
              Marketplace circular de moda universitaria para comprar, vender y rentar
              ropa en Zibatá, Campus Anáhuac Querétaro y alrededores.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Stripe Checkout Ready
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
                <Smartphone className="h-3.5 w-3.5 text-zinc-700" />
                iOS & Android API-First
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                Precio sugerido inteligente
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-950">
              Plataforma
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600">
              <li>
                <Link href="/" className="hover:text-zinc-950">
                  Explorar catálogo
                </Link>
              </li>
              <li>
                <Link href="/?mode=rent" className="hover:text-zinc-950">
                  Rentar para eventos
                </Link>
              </li>
              <li>
                <Link href="/publicar" className="hover:text-zinc-950">
                  Publicar con precio sugerido
                </Link>
              </li>
              <li>
                <Link href="/chat" className="hover:text-zinc-950">
                  Chat universitario
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-950">
              Puntos de entrega Zibatá
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600">
              <li>Campus Anáhuac Querétaro</li>
              <li>Paseo Zibatá</li>
              <li>Xentric Anáhuac</li>
              <li>Town Center & Plaza Zielo</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-zinc-100 pt-6 text-xs text-zinc-500 sm:flex-row sm:items-center">
          <p>© 2026 zibataWear · Hecho en Zibatá, Querétaro.</p>
          <p className="font-mono">API v1 · Next.js + Supabase + Stripe</p>
        </div>
      </div>
    </footer>
  );
}
