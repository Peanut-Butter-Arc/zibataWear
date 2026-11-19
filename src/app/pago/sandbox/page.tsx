"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  Lock,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { formatMxn } from "@/core/constants/zibata";
import type { OrderWithDetails } from "@/core/types/domain";
import { useToast } from "@/components/providers/ToastProvider";

function SandboxContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const { showToast } = useToast();

  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    let active = true;
    fetch(`/api/v1/orders?id=${encodeURIComponent(orderId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.order) setOrder(data.order);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orderId]);

  const handleAction = async (action: "confirm" | "cancel") => {
    if (!order) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/v1/checkout/demo-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "No se pudo procesar la orden.", "error");
        return;
      }
      showToast(
        action === "confirm" ? "Pago demo confirmado" : "Orden cancelada",
        action === "confirm" ? "success" : "info"
      );
      router.push(data.redirectUrl);
    } catch {
      showToast("Error de red al confirmar.", "error");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="h-96 animate-pulse rounded-3xl bg-zinc-200/70" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="rounded-3xl border border-zinc-200 bg-white p-8">
          <p className="text-base font-semibold text-zinc-950">
            No encontramos esta orden de pago
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Volver al catálogo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-10 sm:px-6">
      <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-3.5 text-xs text-amber-900">
          <div className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4 text-amber-600" />
            Pasarela Stripe en Modo Sandbox Preview (Fase 1)
          </div>
          <p className="mt-1 text-amber-800/90">
            Tu flujo ya está conectado al endpoint real{" "}
            <code className="font-mono">/api/v1/checkout</code>. Cuando agreguemos tus
            claves <code className="font-mono">STRIPE_SECRET_KEY</code> en Fase 2, este
            botón abrirá Stripe Checkout oficial automáticamente.
          </p>
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-zinc-900" />
              <h1 className="text-xl font-semibold text-zinc-950">
                Resumen de {order.order_type === "rent" ? "Renta" : "Compra"}
              </h1>
            </div>
            <span className="font-mono text-xs text-zinc-500">
              #{order.id.slice(0, 8)}
            </span>
          </div>

          <div className="mt-6 flex items-center gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-200">
              {order.listing?.images?.[0] && (
                <Image
                  src={order.listing.images[0]}
                  alt={order.listing.title}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase text-zinc-400">
                {order.listing?.brand} · Talla {order.listing?.size}
              </p>
              <p className="truncate text-sm font-semibold text-zinc-950">
                {order.listing?.title}
              </p>
              <p className="mt-1 flex items-center gap-1 text-xs text-zinc-600">
                <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                Entrega en {order.meetup_zone}
              </p>
              {order.order_type === "rent" && order.rental_start_date && (
                <p className="mt-0.5 text-xs font-medium text-emerald-700">
                  Del {order.rental_start_date} al {order.rental_end_date} (
                  {order.rental_days} días)
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-2.5 rounded-2xl bg-zinc-50 p-4 text-sm">
            <div className="flex justify-between text-zinc-600">
              <span>Subtotal {order.order_type === "rent" ? "renta" : "prenda"}</span>
              <span className="tabular-nums font-medium text-zinc-900">
                {formatMxn(order.subtotal_mxn)}
              </span>
            </div>
            {order.deposit_mxn > 0 && (
              <div className="flex justify-between text-zinc-600">
                <span>Fianza de garantía reembolsable</span>
                <span className="tabular-nums font-medium text-zinc-900">
                  {formatMxn(order.deposit_mxn)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-zinc-600">
              <span>Protección Zibatá (5%)</span>
              <span className="tabular-nums font-medium text-zinc-900">
                {formatMxn(order.service_fee_mxn)}
              </span>
            </div>
            <div className="flex justify-between border-t border-zinc-200 pt-2.5 text-base font-bold text-zinc-950">
              <span>Total MXN</span>
              <span className="tabular-nums">{formatMxn(order.total_mxn)}</span>
            </div>
          </div>

          <div className="mt-6 space-y-2.5">
            <button
              type="button"
              disabled={processing}
              onClick={() => handleAction("confirm")}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              {processing
                ? "Procesando..."
                : `Confirmar pago de prueba · ${formatMxn(order.total_mxn)}`}
            </button>
            <button
              type="button"
              disabled={processing}
              onClick={() => handleAction("cancel")}
              className="flex h-10 w-full items-center justify-center rounded-2xl border border-zinc-200 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Cancelar y volver a la prenda
            </button>
          </div>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-zinc-500">
            <Lock className="h-3.5 w-3.5 text-emerald-600" />
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Simulación segura sin cargo real a tarjeta
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SandboxCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-xl px-4 py-16">
          <div className="h-96 animate-pulse rounded-3xl bg-zinc-200/70" />
        </div>
      }
    >
      <SandboxContent />
    </Suspense>
  );
}
