# Guía de Migración a iOS / Android y Activación de Stripe — zibataWear

Esta arquitectura fue diseñada **API-first y modular** para llevar **zibataWear** a App Store (iOS) y Google Play (Android) sin reescribir la lógica de negocio ni la base de datos.

---

## 1. Lo que ya es 100% reutilizable en Móvil

1. **`src/core/` (cero dependencias de Next.js o DOM)**
   - `src/core/constants/zibata.ts`: zonas de Zibatá, categorías, tallas, condiciones y formato MXN.
   - `src/core/types/domain.ts`: modelos tipados (`Profile`, `Listing`, `Order`, `Conversation`, `Message`).
   - `src/core/schemas/validation.ts`: validaciones `zod` compartidas entre Web, iOS, Android y Backend.
   - `src/core/pricing/engine.ts`: motor de recomendación de precio de venta, tarifa de renta por día, depósito y copy.
   - `src/core/api/client.ts`: clase `ZibataApiClient` lista para consumir `/api/v1/*` con `Authorization: Bearer <token>` desde React Native / Expo.

2. **Backend REST `/api/v1/*` con soporte Dual Auth (`src/lib/supabase/api-auth.ts`)**
   - En Web usa cookies HTTP-only (`@supabase/ssr`).
   - En iOS / Android acepta `Authorization: Bearer <access_token>` de Supabase Auth (el mismo login OTP de 6 dígitos).
   - Incluye headers CORS listos para clientes nativos.

---

## 2. Dos caminos para publicar en iOS y Android

### Opción A — Capacitor (más rápida, ~15 min a App Store / Play Store)
1. Instala Capacitor en el proyecto:
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
   ```
2. Ya incluimos `capacitor.config.ts` apuntando a tu URL de producción en Vercel (`com.zibatawear.app`).
3. Agrega las plataformas nativas y compila:
   ```bash
   npx cap add ios
   npx cap add android
   npx cap sync
   npx cap open ios      # abre Xcode
   npx cap open android  # abre Android Studio
   ```

### Opción B — React Native / Expo Nativo (UI 100% nativa)
1. Crea una app Expo junto a este repo o dentro de `apps/mobile`.
2. Copia o comparte la carpeta `src/core/` directamente.
3. Conecta los SDKs oficiales:
   - `@supabase/supabase-js` (Auth con código OTP de 6 dígitos, Realtime chat y Storage).
   - `@stripe/stripe-react-native` (PaymentSheet nativo con Apple Pay y Google Pay).
4. Pasa el JWT de sesión a `new ZibataApiClient({ baseUrl: "https://tu-dominio.vercel.app", getAccessToken: async () => session?.access_token ?? null })`.

---

## 3. Checklist para activar Stripe real (Fase 2)

Cuando estés listo para activar cobros con tarjeta reales (en Test Mode o Live Mode):

1. En **Stripe Dashboard → API Keys**, copia:
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_test_...` o `pk_live_...`)
   - `STRIPE_SECRET_KEY` (`sk_test_...` o `sk_live_...`)
2. En **Stripe Dashboard → Webhooks**, crea un endpoint apuntando a:
   `https://TU_DOMINIO.vercel.app/api/v1/webhooks/stripe`
   Eventos recomendados:
   - `checkout.session.completed`
   - `checkout.session.expired`
   Copia el `STRIPE_WEBHOOK_SECRET` (`whsec_...`).
3. En **Supabase Dashboard → Settings → API Keys**, copia tu clave secreta (`SUPABASE_SERVICE_ROLE_KEY` / `sb_secret_...`) para que el webhook actualice el estatus de órdenes y prendas en servidor.
4. Carga esas 4 variables en **Vercel → Project Settings → Environment Variables** y haz redeploy.
   El endpoint `/api/v1/checkout` detectará `STRIPE_SECRET_KEY` automáticamente y redirigirá a Stripe Checkout real.
