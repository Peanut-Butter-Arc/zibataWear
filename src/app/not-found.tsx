import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-xs">
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-emerald-600">
          404 · zibataWear
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
          Esta prenda o página no está disponible
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Es posible que ya se haya vendido o que el enlace esté incompleto. Explora el clóset universitario en Zibatá.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Explorar catálogo
          </Link>
          <Link
            href="/publicar"
            className="rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Publicar prenda
          </Link>
        </div>
      </div>
    </div>
  );
}
