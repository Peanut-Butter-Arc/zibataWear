"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import {
  BadgeCheck,
  ChevronDown,
  LogOut,
  MessageCircle,
  Plus,
  ShoppingBag,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const displayName =
    profile?.full_name?.trim() ||
    user?.email?.split("@")[0] ||
    "Mi cuenta";
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-950 text-sm font-bold tracking-tight text-white transition group-hover:scale-105">
              zW
            </span>
            <span className="text-lg font-semibold tracking-tight text-zinc-950">
              zibata<span className="font-normal text-zinc-500">Wear</span>
            </span>
          </Link>

          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 md:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Zibatá · Anáhuac Qro
          </span>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          <Link
            href="/"
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition",
              pathname === "/"
                ? "bg-zinc-950 text-white"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
            )}
          >
            Explorar
          </Link>
          <Link
            href="/?mode=rent"
            className="rounded-full px-3.5 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
          >
            Rentar
          </Link>
          <Link
            href="/publicar"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition",
              pathname === "/publicar"
                ? "bg-zinc-950 text-white"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
            )}
          >
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            Vender o rentar
          </Link>
          <Link
            href="/chat"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition",
              pathname.startsWith("/chat")
                ? "bg-zinc-950 text-white"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
            )}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Chat
          </Link>
        </nav>

        <div className="flex items-center gap-2.5">
          <Link
            href="/publicar"
            className="hidden items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-zinc-800 sm:inline-flex"
          >
            <Plus className="h-3.5 w-3.5" />
            Publicar prenda
          </Link>

          {loading ? (
            <div className="h-9 w-24 animate-pulse rounded-full bg-zinc-200/70" />
          ) : user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white py-1 pr-3 pl-1.5 text-sm font-medium text-zinc-900 shadow-xs transition hover:border-zinc-300"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-950 text-xs font-semibold text-white">
                  {initials || "U"}
                </span>
                <span className="hidden max-w-[110px] truncate sm:inline">
                  {displayName}
                </span>
                {profile?.is_student_verified && (
                  <BadgeCheck className="h-4 w-4 text-emerald-600" />
                )}
                <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl border border-zinc-200 bg-white p-2 shadow-xl">
                  <div className="border-b border-zinc-100 px-3 py-2.5">
                    <p className="truncate text-sm font-semibold text-zinc-950">
                      {displayName}
                    </p>
                    <p className="truncate text-xs text-zinc-500">{user.email}</p>
                    {profile?.is_student_verified ? (
                      <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        <BadgeCheck className="h-3 w-3" />
                        Universitario verificado
                      </span>
                    ) : (
                      <span className="mt-1.5 inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                        Comunidad Zibatá
                      </span>
                    )}
                  </div>

                  <div className="py-1.5">
                    <Link
                      href="/cuenta"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
                    >
                      <UserIcon className="h-4 w-4 text-zinc-500" />
                      Mi cuenta y perfil
                    </Link>
                    <Link
                      href="/cuenta?tab=ordenes"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
                    >
                      <ShoppingBag className="h-4 w-4 text-zinc-500" />
                      Mis compras y rentas
                    </Link>
                    <Link
                      href="/chat"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
                    >
                      <MessageCircle className="h-4 w-4 text-zinc-500" />
                      Mensajes en campus
                    </Link>
                  </div>

                  <div className="border-t border-zinc-100 pt-1.5">
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/auth"
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-950 shadow-xs transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              Ingresar con código
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
