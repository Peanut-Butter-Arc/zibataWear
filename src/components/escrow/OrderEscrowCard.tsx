"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  MapPin,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { formatMxn } from "@/core/constants/zibata";
import type { OrderWithDetails } from "@/core/types/domain";
import { useToast } from "@/components/providers/ToastProvider";
import { cn } from "@/lib/utils";

interface OrderEscrowCardProps {
  order: OrderWithDetails;
  role: "buyer" | "seller";
  compact?: boolean;
  onUpdated?: () => Promise<void> | void;
}

const ORDER_STATUS_META: Record<string, { label: string; tone: string }> = {
  pending: { label: "Pendiente de pago", tone: "bg-amber-50 text-amber-700" },
  paid: { label: "En custodia · Esperando entrega", tone: "bg-emerald-50 text-emerald-700" },
  demo_paid: { label: "En custodia · Esperando entrega", tone: "bg-emerald-50 text-emerald-700" },
  active_rental: { label: "Renta activa · Fondos liberados", tone: "bg-blue-50 text-blue-700" },
  completed: { label: "Completada · Depósito liberado", tone: "bg-zinc-900 text-white" },
  cancelled: { label: "Cancelada", tone: "bg-rose-50 text-rose-700" },
  refunded: { label: "Reembolsada", tone: "bg-zinc-100 text-zinc-700" },
};

function formatCodeDisplay(code: string): string {
  const clean = code.replace(/\D/g, "").slice(0, 6);
  if (clean.length <= 3) return clean;
  return `${clean.slice(0, 3)} · ${clean.slice(3)}`;
}

export function OrderEscrowCard({
  order,
  role,
  compact = false,
  onUpdated,
}: OrderEscrowCardProps) {
  const { showToast } = useToast();
  const [pinVisible, setPinVisible] = useState(true);
  const [copied, setCopied] = useState(false);
  const [handoverInput, setHandoverInput] = useState("");
  const [returnInput, setReturnInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const payoutStatus = order.payout_status ?? "unpaid";
  const sellerPayout = order.seller_payout_mxn || order.subtotal_mxn;
  const isHeld = payoutStatus === "held_in_escrow";
  const isReleased =
    payoutStatus === "released" || payoutStatus === "transferred_stripe";
  const stepIndex = payoutStatus === "unpaid" ? 0 : isHeld ? 1 : 3;

  const badge = ORDER_STATUS_META[order.status] ?? {
    label: order.status,
    tone: "bg-zinc-100 text-zinc-700",
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      showToast("Código copiado", "success");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast("No pudimos copiar automáticamente.", "error");
    }
  };

  const handleConfirmHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = handoverInput.replace(/\D/g, "");
    if (clean.length !== 6) {
      setErrorMsg("Ingresa los 6 dígitos exactos del comprador.");
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/v1/orders/${encodeURIComponent(order.id)}/confirm-handover`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: clean }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "Código incorrecto.");
        showToast(data.error ?? "Código incorrecto.", "error");
        return;
      }

      showToast(
        data.stripe_transfer_id
          ? `¡Entrega confirmada! Transferencia Stripe de ${formatMxn(sellerPayout)} enviada.`
          : `¡Entrega confirmada! Se liberaron ${formatMxn(sellerPayout)} a tu Billetera.`,
        "success"
      );
      setHandoverInput("");
      await onUpdated?.();
    } catch {
      setErrorMsg("Error de red al validar código.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmReturn = async (useCode: boolean) => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const clean = returnInput.replace(/\D/g, "");
      const res = await fetch(
        `/api/v1/orders/${encodeURIComponent(order.id)}/confirm-return`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(useCode ? { code: clean } : {}),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? "No se pudo confirmar la devolución.");
        showToast(data.error ?? "Error confirmando devolución.", "error");
        return;
      }
      showToast("Devolución confirmada · Renta completada", "success");
      setReturnInput("");
      await onUpdated?.();
    } catch {
      setErrorMsg("Error de red.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200/90 bg-zinc-50/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
              badge.tone
            )}
          >
            <ShieldCheck className="h-3 w-3" />
            {badge.label}
          </span>
          <p className="mt-1.5 truncate text-sm font-semibold text-zinc-950">
            {order.listing?.title ?? "Prenda zibataWear"}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-zinc-500">
            <MapPin className="h-3 w-3 text-emerald-600" />
            {order.meetup_zone}
            <span>·</span>
            <span>
              {role === "buyer"
                ? `Vende: ${order.seller?.full_name || "Estudiante Zibatá"}`
                : `Compra: ${order.buyer?.full_name || "Estudiante Zibatá"}`}
            </span>
            {order.order_type === "rent" && order.rental_start_date
              ? ` · ${order.rental_start_date} a ${order.rental_end_date}`
              : ""}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <span
            className={cn(
              "tabular-nums text-sm font-bold",
              role === "seller" ? "text-emerald-700" : "text-zinc-950"
            )}
          >
            {role === "seller"
              ? `+${formatMxn(sellerPayout)}`
              : formatMxn(order.total_mxn)}
          </span>
          <p className="text-[10px] text-zinc-500">
            {role === "seller"
              ? isReleased
                ? payoutStatus === "transferred_stripe"
                  ? "Depositado Stripe"
                  : "En tu billetera"
                : isHeld
                  ? "En custodia"
                  : "Por cobrar"
              : "Incl. protección zibataWear"}
          </p>
        </div>
      </div>

      {/* 3-Step Visual Escrow Progress */}
      {order.status !== "cancelled" && (
        <div className="mt-3 grid grid-cols-3 gap-1.5 text-[10px] font-medium">
          {[
            { label: "1. Pago retenido", active: stepIndex >= 1 },
            { label: "2. Código 6 dígitos", active: stepIndex >= 2 || isHeld },
            { label: "3. Depósito liberado", active: stepIndex >= 3 },
          ].map((step) => (
            <div
              key={step.label}
              className={cn(
                "rounded-lg px-2 py-1 text-center transition",
                step.active
                  ? "bg-emerald-100/80 text-emerald-800"
                  : "bg-zinc-200/70 text-zinc-500"
              )}
            >
              {step.label}
            </div>
          ))}
        </div>
      )}

      {/* Buyer Handover Code Vault */}
      {role === "buyer" && isHeld && order.handover_code && (
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-white p-3.5 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
              <KeyRound className="h-3.5 w-3.5 text-emerald-600" />
              Tu código de entrega (solo comprador)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPinVisible((prev) => !prev)}
                className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                aria-label={pinVisible ? "Ocultar código" : "Mostrar código"}
              >
                {pinVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => handleCopyCode(order.handover_code!)}
                className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          </div>

          <p className="tabular-nums mt-2 rounded-xl bg-zinc-950 py-2.5 text-center font-mono text-xl font-bold tracking-[0.2em] text-white">
            {pinVisible ? formatCodeDisplay(order.handover_code) : "••• · •••"}
          </p>

          <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
            <Lock className="mr-1 inline h-3 w-3 text-amber-600" />
            Entrégale este código al vendedor <strong>solo cuando revises la prenda en persona</strong>. Al ingresarlo se libera su pago.
          </p>
        </div>
      )}

      {/* Seller Code Confirmation Form */}
      {role === "seller" && isHeld && (
        <form
          onSubmit={handleConfirmHandover}
          className="mt-3 space-y-2.5 rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-2xs"
        >
          <div className="flex items-center justify-between gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-950">
              <KeyRound className="h-3.5 w-3.5 text-emerald-600" />
              Confirmar entrega para liberar {formatMxn(sellerPayout)}
            </label>
            <span className="text-[10px] font-medium text-zinc-500">
              5 intentos máx.
            </span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={handoverInput}
              onChange={(e) =>
                setHandoverInput(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="Código 6 dígitos del comprador"
              className="h-10 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-center font-mono text-sm font-bold tracking-[0.25em] text-zinc-950 outline-none focus:border-zinc-950 focus:bg-white"
            />
            <button
              type="submit"
              disabled={submitting || handoverInput.length !== 6}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {submitting ? "Validando..." : "Liberar dinero"}
            </button>
          </div>

          {errorMsg && (
            <p className="text-[11px] font-medium text-rose-600">{errorMsg}</p>
          )}
        </form>
      )}

      {/* Rental Return Confirmation */}
      {order.order_type === "rent" && order.status === "active_rental" && (
        <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50/60 p-3.5">
          {role === "seller" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs text-blue-950">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <RotateCcw className="h-3.5 w-3.5 text-blue-600" />
                  Código de devolución de renta
                </span>
                {order.return_code && (
                  <span className="rounded-lg bg-white px-2.5 py-0.5 font-mono text-sm font-bold text-blue-950">
                    {formatCodeDisplay(order.return_code)}
                  </span>
                )}
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleConfirmReturn(false)}
                className="w-full rounded-xl bg-zinc-950 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {submitting ? "Procesando..." : "Confirmar que ya me devolvieron la prenda"}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-blue-950">
                ¿Ya devolviste la prenda? Ingresa el código de devolución del vendedor
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={returnInput}
                  onChange={(e) =>
                    setReturnInput(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="Código 6 dígitos"
                  className="h-9 flex-1 rounded-xl border border-blue-200 bg-white px-3 text-center font-mono text-xs font-bold tracking-widest outline-none focus:border-zinc-950"
                />
                <button
                  type="button"
                  disabled={submitting || returnInput.length !== 6}
                  onClick={() => handleConfirmReturn(true)}
                  className="h-9 rounded-xl bg-zinc-950 px-3 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Cerrar renta
                </button>
              </div>
              {errorMsg && (
                <p className="text-[11px] font-medium text-rose-600">{errorMsg}</p>
              )}
            </div>
          )}
        </div>
      )}

      {!compact && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-[11px] text-zinc-500">
            Subtotal {formatMxn(order.subtotal_mxn)} · Comisión zibataWear ({formatMxn(order.service_fee_mxn)})
            {order.deposit_mxn > 0 ? ` · Fianza ${formatMxn(order.deposit_mxn)}` : ""}
          </span>

          <div className="flex gap-2">
            <Link
              href={`/pago/exito?orderId=${order.id}`}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Ver recibo
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
