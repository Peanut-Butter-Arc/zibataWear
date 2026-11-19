"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-xs">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-base font-bold text-white">
          zW
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-950">
          Algo salió mal al cargar
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Tuvimos un problema temporal conectando con zibataWear. Intenta recargar en un segundo.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </button>
          <Link
            href="/"
            className="rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Ir al catálogo
          </Link>
        </div>
      </div>
    </div>
  );
}
