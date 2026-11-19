"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  ChevronDown,
  ExternalLink,
  MapPin,
  MessageCircle,
  Send,
  ShieldCheck,
} from "lucide-react";
import { formatMxn } from "@/core/constants/zibata";
import type {
  ConversationWithDetails,
  Message,
  OrderWithDetails,
} from "@/core/types/domain";
import { OrderEscrowCard } from "@/components/escrow/OrderEscrowCard";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const QUICK_REPLIES = [
  "¿Sigue disponible?",
  "¿Nos vemos en Campus Anáhuac?",
  "¿Disponible este fin de semana para renta?",
  "¿Podemos vernos en Paseo Zibatá?",
];

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedIdParam = searchParams.get("id");

  const supabase = useMemo(() => createClient(), []);
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [manualActiveId, setManualActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeOrder, setActiveOrder] = useState<OrderWithDetails | null>(null);
  const [escrowExpanded, setEscrowExpanded] = useState(true);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadedRoomId, setLoadedRoomId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  const activeId = selectedIdParam ?? manualActiveId ?? conversations[0]?.id ?? null;
  const loadingMessages = Boolean(activeId && user && loadedRoomId !== activeId);

  useEffect(() => {
    if (authLoading) return;
    let active = true;

    async function fetchThreads() {
      if (!user) {
        if (active) setLoadingThreads(false);
        return;
      }
      try {
        const res = await fetch("/api/v1/conversations");
        if (res.ok && active) {
          const data = await res.json();
          setConversations((data.conversations ?? []) as ConversationWithDetails[]);
        }
      } finally {
        if (active) setLoadingThreads(false);
      }
    }

    fetchThreads();
    return () => {
      active = false;
    };
  }, [authLoading, user]);

  useEffect(() => {
    if (!activeId || !user) return;
    const roomId = activeId;
    let active = true;

    async function fetchRoomMessages() {
      try {
        const res = await fetch(
          `/api/v1/conversations/${encodeURIComponent(roomId)}/messages`
        );
        const data = await res.json();
        if (active) {
          setMessages(data.messages ?? []);
          setLoadedRoomId(roomId);
        }
      } catch {
        if (active) setLoadedRoomId(roomId);
      }
    }

    fetchRoomMessages();

    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${roomId}`,
        },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
          setConversations((prev) =>
            prev.map((c) =>
              c.id === roomId
                ? {
                    ...c,
                    last_message_text: incoming.body.slice(0, 160),
                    last_message_at: incoming.created_at,
                  }
                : c
            )
          );
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [activeId, user, supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId]
  );

  const reloadActiveOrder = useCallback(async () => {
    const listingId = activeConversation?.listing_id;
    if (!listingId || !user) {
      setActiveOrder(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/v1/orders?listingId=${encodeURIComponent(listingId)}`
      );
      if (res.ok) {
        const data = await res.json();
        setActiveOrder(data.order ?? null);
      }
    } catch {
      // Ignore transient order check error
    }
  }, [activeConversation?.listing_id, user]);

  useEffect(() => {
    let active = true;
    const listingId = activeConversation?.listing_id;
    if (!listingId || !user) {
      Promise.resolve().then(() => {
        if (active) setActiveOrder(null);
      });
      return () => {
        active = false;
      };
    }

    fetch(`/api/v1/orders?listingId=${encodeURIComponent(listingId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active) setActiveOrder(data?.order ?? null);
      })
      .catch(() => {
        if (active) setActiveOrder(null);
      });

    return () => {
      active = false;
    };
  }, [activeConversation?.listing_id, user]);

  const sendMessage = async (textToSend?: string) => {
    const body = (textToSend ?? draft).trim();
    if (!body || !activeId || sending) return;

    setSending(true);
    if (!textToSend) setDraft("");
    try {
      const res = await fetch(
        `/api/v1/conversations/${encodeURIComponent(activeId)}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "No se pudo enviar el mensaje.", "error");
        if (!textToSend) setDraft(body);
        return;
      }

      if (data.message) {
        setMessages((prev) =>
          prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]
        );
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeId
              ? {
                  ...c,
                  last_message_text: data.message.body.slice(0, 160),
                  last_message_at: data.message.created_at,
                }
              : c
          )
        );
      }
    } catch {
      showToast("Error enviando mensaje.", "error");
    } finally {
      setSending(false);
    }
  };

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-3xl border border-zinc-200 bg-white p-10">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-white">
            <MessageCircle className="h-6 w-6 text-emerald-400" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold text-zinc-950">
            Menú de Chat zibataWear
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Inicia sesión con tu código de 6 dígitos para chatear en tiempo real con
            vendedores y acordar entregas en Campus Anáhuac o Zibatá.
          </p>
          <Link
            href="/auth?next=/chat"
            className="mt-6 inline-flex rounded-full bg-zinc-950 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Ingresar con código
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
            Mensajes en Zibatá
          </h1>
          <p className="text-xs text-zinc-500">
            Chat en tiempo real para coordinar tallas, rentas y puntos de entrega.
          </p>
        </div>
      </div>

      <div className="grid h-[calc(100vh-14rem)] min-h-[520px] overflow-hidden rounded-3xl border border-zinc-200 bg-white md:grid-cols-12">
        {/* Thread List */}
        <aside
          className={cn(
            "flex flex-col border-r border-zinc-200 md:col-span-4",
            selectedIdParam ? "hidden md:flex" : "flex"
          )}
        >
          <div className="border-b border-zinc-100 px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Conversaciones ({conversations.length})
          </div>

          <div className="flex-1 divide-y divide-zinc-100 overflow-y-auto">
            {loadingThreads ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-2xl bg-zinc-100" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-medium text-zinc-900">
                  Aún no tienes mensajes
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Entra a cualquier prenda en el catálogo y toca &ldquo;Chatear con el
                  vendedor&rdquo;.
                </p>
                <Link
                  href="/"
                  className="mt-4 inline-flex rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white"
                >
                  Explorar prendas
                </Link>
              </div>
            ) : (
              conversations.map((conv) => {
                const other =
                  conv.buyer_id === user?.id ? conv.seller : conv.buyer;
                const thumb = conv.listing?.images?.[0];
                const isSelected = conv.id === activeId;

                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => {
                      setManualActiveId(conv.id);
                      router.replace(`/chat?id=${conv.id}`, { scroll: false });
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3.5 text-left transition",
                      isSelected ? "bg-zinc-100/80" : "hover:bg-zinc-50"
                    )}
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                      {thumb ? (
                        <Image
                          src={thumb}
                          alt={conv.listing?.title ?? "Prenda"}
                          fill
                          sizes="60px"
                          className="object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="truncate text-sm font-semibold text-zinc-950">
                          {other?.full_name || "Estudiante Zibatá"}
                        </p>
                        {other?.is_student_verified && (
                          <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        )}
                      </div>
                      <p className="truncate text-xs font-medium text-zinc-600">
                        {conv.listing?.title ?? "Prenda"}
                      </p>
                      <p className="truncate text-xs text-zinc-400">
                        {conv.last_message_text}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Active Conversation Pane */}
        <section
          className={cn(
            "flex flex-col md:col-span-8",
            selectedIdParam ? "flex" : "hidden md:flex"
          )}
        >
          {activeConversation ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setManualActiveId(null);
                      router.replace("/chat", { scroll: false });
                    }}
                    aria-label="Volver a conversaciones"
                    className="rounded-full p-1.5 text-zinc-600 hover:bg-zinc-100 md:hidden"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-zinc-950">
                        {(activeConversation.buyer_id === user?.id
                          ? activeConversation.seller?.full_name
                          : activeConversation.buyer?.full_name) ||
                          "Estudiante Zibatá"}
                      </p>
                      {(activeConversation.buyer_id === user?.id
                        ? activeConversation.seller?.is_student_verified
                        : activeConversation.buyer?.is_student_verified) && (
                        <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                      )}
                    </div>
                    <p className="flex items-center gap-1.5 truncate text-xs text-zinc-500">
                      <span>{activeConversation.listing?.title}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-0.5 text-emerald-700">
                        <MapPin className="h-3 w-3" />
                        {activeConversation.listing?.meetup_zone}
                      </span>
                    </p>
                  </div>
                </div>

                {activeConversation.listing && (
                  <Link
                    href={`/prenda/${activeConversation.listing.id}`}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-100"
                  >
                    <span className="tabular-nums">
                      {activeConversation.listing.sale_price_mxn
                        ? formatMxn(activeConversation.listing.sale_price_mxn)
                        : activeConversation.listing.rent_price_per_day_mxn
                          ? `${formatMxn(
                              activeConversation.listing.rent_price_per_day_mxn
                            )}/d`
                          : "Ver"}
                    </span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>

              {activeOrder &&
                (activeOrder.payout_status === "held_in_escrow" ||
                  activeOrder.status === "active_rental") && (
                  <div className="border-b border-emerald-200/80 bg-emerald-50/40 px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => setEscrowExpanded((prev) => !prev)}
                      className="flex w-full items-center justify-between gap-2 text-left text-xs font-semibold text-emerald-900"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        {activeOrder.payout_status === "held_in_escrow"
                          ? "Pago en custodia activo · Confirma código de 6 dígitos en la entrega"
                          : "Renta activa · Código de devolución disponible"}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-emerald-700 transition",
                          escrowExpanded ? "rotate-180" : ""
                        )}
                      />
                    </button>
                    {escrowExpanded && (
                      <div className="mt-2.5">
                        <OrderEscrowCard
                          order={activeOrder}
                          role={activeOrder.buyer_id === user?.id ? "buyer" : "seller"}
                          compact
                          onUpdated={reloadActiveOrder}
                        />
                      </div>
                    )}
                  </div>
                )}

              <div className="flex-1 space-y-3 overflow-y-auto bg-[#fafafa] p-4">
                {loadingMessages ? (
                  <div className="space-y-3">
                    <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-zinc-200/70" />
                    <div className="ml-auto h-10 w-1/2 animate-pulse rounded-2xl bg-zinc-200/70" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-12 text-center text-xs text-zinc-500">
                    Envía el primer mensaje para coordinar tu compra o renta en Zibatá.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.sender_id === user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={cn("flex", isMine ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-2xs",
                            isMine
                              ? "rounded-br-sm bg-zinc-950 text-white"
                              : "rounded-bl-sm border border-zinc-200 bg-white text-zinc-900"
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                          <p className="mt-1 text-[10px] text-zinc-400">
                            {new Date(msg.created_at).toLocaleTimeString("es-MX", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-zinc-200 bg-white p-3 sm:p-4">
                <div className="no-scrollbar mb-2.5 flex gap-1.5 overflow-x-auto">
                  {QUICK_REPLIES.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => sendMessage(chip)}
                      className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-medium text-zinc-700 transition hover:border-zinc-950 hover:text-zinc-950"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="h-11 flex-1 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none transition focus:border-zinc-950 focus:bg-white"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || sending}
                    aria-label="Enviar mensaje"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-white transition hover:bg-zinc-800 disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-zinc-500">
              <MessageCircle className="h-8 w-8 text-zinc-300" />
              <p className="mt-2 text-sm font-medium text-zinc-900">
                Selecciona una conversación
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Aquí verás todos tus chats con compradores y vendedores de Zibatá.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="h-[520px] animate-pulse rounded-3xl bg-zinc-200/70" />
        </div>
      }
    >
      <ChatContent />
    </Suspense>
  );
}
