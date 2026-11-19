"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  CheckCircle2,
  MapPin,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { formatMxn } from "@/core/constants/zibata";
import type { OrderStatus, OrderWithDetails } from "@/core/types/domain";
import { useToast } from "@/components/providers/ToastProvider";

function formatOrderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case "paid":
      return "Pagada con Stripe";
    case "active_rental":
      return "Renta activa";
    case "demo_paid":
      return "Confirmada (Sandbox)";
    case "completed":
      return "Completada";
    case "cancelled":
      return "Cancelada";
    case "refunded":
      return "Reembolsada";
    default:
      return "Procesando confirmación";
  }
}

function ExitoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const sessionId = searchParams.get("session_id");
  const { showToast } = useToast();

  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [openingChat, setOpeningChat] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    let active = true;

    async function loadOrder() {
      try {
        if (sessionId) {
          const verifyRes = await fetch("/api/v1/checkout/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId, sessionId }),
          });
          if (verifyRes.ok) {
            const verifyData = await verifyRes.json();
            if (active && verifyData?.order) {
              setOrder(verifyData.order);
              return;
            }
          }
        }

        const res = await fetch(`/api/v1/orders?id=${encodeURIComponent(orderId ?? "")}`);
        const data = res.ok ? await res.json() : null;
        if (active && data?.order) {
          setOrder(data.order);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadOrder();
    return () => {
      active = false;
    };
  }, [orderId, sessionId]);

  const handleOpenChat = async () => {
    if (!order?.listing_id) return;
    setOpeningChat(true);
    try {
      const res = await fetch("/api/v1/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: order.listing_id }),
      });
      const data = await res.json();
      if (res.ok && data.conversation?.id) {
        router.push(`/chat?id=${data.conversation.id}`);
      } else {
        showToast(data.error ?? "No se pudo abrir el chat.", "error");
      }
    } finally {
      setOpeningChat(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="h-80 animate-pulse rounded-3xl bg-zinc-200/70" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 pb-24 pt-12 sm:px-6">
      <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-xs">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-8 w-8" />
        </span>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-950">
          ¡Orden confirmada en zibataWear!
        </h1>
        <p className="mt-1.5 text-sm text-zinc-600">
          Ya puedes coordinar la hora exacta de entrega en Zibatá directo por chat.
        </p>

        {order && (
          <div className="mt-6 space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-left text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">Prenda</span>
              <span className="text-right font-semibold text-zinc-950">
                {order.listing?.title ?? "Prenda Zibatá"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">Modalidad</span>
              <span className="font-medium text-zinc-900">
                {order.order_type === "rent"
                  ? `Renta (${order.rental_days} días)`
                  : "Compra directa"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">Estado de pago</span>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                {formatOrderStatusLabel(order.status)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">Punto seguro</span>
              <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                <MapPin className="h-3.5 w-3.5" />
                {order.meetup_zone}
              </span>
            </div>
            <div className="flex justify-between border-t border-zinc-200 pt-2.5 text-base font-bold text-zinc-950">
              <span>Total</span>
              <span className="tabular-nums">{formatMxn(order.total_mxn)}</span>
            </div>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-left text-xs text-emerald-900">
          <p className="flex items-center gap-1.5 font-semibold">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Checklist de entrega segura en Zibatá
          </p>
          <ul className="mt-2 space-y-1 text-emerald-800">
            <li>• Reúnete en áreas públicas del campus o plazas de Zibatá de día.</li>
            <li>• Revisa talla, cierres y estado físico al momento de recibir.</li>
            <li>• En rentas, recuerda la fecha acordada para liberar tu fianza.</li>
          </ul>
        </div>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          {order?.listing_id && (
            <button
              type="button"
              disabled={openingChat}
              onClick={handleOpenChat}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              <MessageCircle className="h-4 w-4" />
              {openingChat ? "Abriendo chat..." : "Coordinar entrega por chat"}
            </button>
          )}
          <Link
            href="/cuenta?tab=ordenes"
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            <ShoppingBag className="h-4 w-4" />
            Ver mis órdenes
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ExitoPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-xl px-4 py-16">
          <div className="h-80 animate-pulse rounded-3xl bg-zinc-200/70" />
        </div>
      }
    >
      <ExitoContent />
    </Suspense>
  );
}
