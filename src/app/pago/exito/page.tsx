"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Lock,
  MapPin,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { formatMxn, PLATFORM_FEE_PERCENT } from "@/core/constants/zibata";
import type { OrderStatus, OrderWithDetails } from "@/core/types/domain";
import { useToast } from "@/components/providers/ToastProvider";

function formatOrderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case "paid":
      return "En custodia · Esperando entrega";
    case "active_rental":
      return "Renta activa · Fondos liberados";
    case "demo_paid":
      return "En custodia (Sandbox)";
    case "completed":
      return "Completada · Depósito liberado";
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
  const [copiedCode, setCopiedCode] = useState(false);

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

  const handleCopyPin = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      showToast("Código de entrega copiado", "success");
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      showToast("No pudimos copiar automáticamente.", "error");
    }
  };

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
          ¡Pago en custodia confirmado!
        </h1>
        <p className="mt-1.5 text-sm text-zinc-600">
          Tu dinero está protegido en zibataWear y se depositará al vendedor solo cuando le entregues el código tras recibir la prenda.
        </p>

        {order?.handover_code && order.payout_status === "held_in_escrow" && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-zinc-950 p-5 text-left text-white shadow-md">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <KeyRound className="h-4 w-4" />
                Tu código de entrega de 6 dígitos
              </span>
              <button
                type="button"
                onClick={() => handleCopyPin(order.handover_code!)}
                className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/20"
              >
                {copiedCode ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copiedCode ? "Copiado" : "Copiar"}
              </button>
            </div>
            <p className="tabular-nums mt-3 text-center font-mono text-3xl font-bold tracking-[0.28em] text-white">
              {order.handover_code.slice(0, 3)} · {order.handover_code.slice(3)}
            </p>
            <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-zinc-300">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
              No compartas este código por chat antes de ver la prenda en persona.
            </p>
          </div>
        )}

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
              <span className="text-zinc-500">Estado de custodia</span>
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
            <div className="flex justify-between gap-4 text-xs text-zinc-500">
              <span>Comisión y custodia zibataWear ({PLATFORM_FEE_PERCENT}%)</span>
              <span className="tabular-nums font-medium text-zinc-700">
                {formatMxn(order.service_fee_mxn)}
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
            <li>• Revisa talla, cierres y estado físico antes de dar tu código de 6 dígitos.</li>
            <li>• En rentas, recuerda la fecha acordada para devolver y liberar tu fianza.</li>
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
