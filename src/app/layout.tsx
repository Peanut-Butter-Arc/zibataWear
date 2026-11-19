import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { Navbar } from "@/components/layout/Navbar";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "zibataWear — Compra, vende y renta ropa universitaria en Zibatá",
    template: "%s · zibataWear",
  },
  description:
    "Marketplace circular de moda universitaria en Zibatá y Campus Anáhuac Querétaro. Compra, vende o renta ropa con recomendación inteligente de precios, chat en tiempo real y pagos con Stripe.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "zibataWear",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fafafa",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-[#fafafa] text-zinc-950 selection:bg-zinc-950 selection:text-white">
        <ToastProvider>
          <AuthProvider>
            <Suspense
              fallback={
                <header className="sticky top-0 z-40 h-16 border-b border-zinc-200/80 bg-white/80 backdrop-blur-xl" />
              }
            >
              <Navbar />
            </Suspense>
            <main className="flex-1">{children}</main>
            <Footer />
            <Suspense fallback={null}>
              <MobileBottomNav />
            </Suspense>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
