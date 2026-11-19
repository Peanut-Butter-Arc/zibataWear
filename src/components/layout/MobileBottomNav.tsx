"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, MessageCircle, PlusSquare, Repeat, User } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const items = [
    { href: "/", label: "Explorar", icon: Compass, active: pathname === "/" },
    {
      href: "/?mode=rent",
      label: "Rentar",
      icon: Repeat,
      active: false,
    },
    {
      href: "/publicar",
      label: "Publicar",
      icon: PlusSquare,
      active: pathname === "/publicar",
    },
    {
      href: "/chat",
      label: "Chat",
      icon: MessageCircle,
      active: pathname.startsWith("/chat"),
    },
    {
      href: user ? "/cuenta" : "/auth",
      label: user ? "Cuenta" : "Ingresar",
      icon: User,
      active: pathname.startsWith("/cuenta") || pathname.startsWith("/auth"),
    },
  ];

  return (
    <nav
      aria-label="Navegación móvil"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200/90 bg-white/90 backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 px-2 pt-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-medium transition",
                item.active ? "text-zinc-950" : "text-zinc-500 hover:text-zinc-900"
              )}
            >
              <Icon className={cn("h-5 w-5", item.active && "stroke-[2.4]")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
