# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

VELA — a Spanish-language event marketplace (React + Vite SPA on the frontend, Supabase for auth/db/storage/edge functions). Attendees discover and buy tickets (`boletos`) for events (`eventos`); hosts (`anfitriones`) create events and get paid out via Mercado Pago. Deployed to Vercel (SPA rewrite in `vercel.json`).

## Commands

```
npm run dev       # start Vite dev server
npm run build     # production build (terser minify, console/debugger stripped, no sourcemaps)
npm run lint      # eslint . (flat config, eslint.config.js)
npm run preview   # preview a production build
```

There is no test runner configured in `package.json`. `loadtest/test.js` is a standalone k6 load-test script (`k6 run loadtest/test.js`) that hits the deployed Vercel URL, not local dev.

Supabase edge functions are deployed independently via the Supabase CLI (`supabase functions deploy <name>`), not through the Vite build.

## Architecture

**Single-file pages, no shared UI kit.** Everything lives in `src/pages/*.jsx` — each page is one large component file with inline `style={{...}}` objects (no CSS modules/styled-components/Tailwind classes in JS, even though Tailwind is a dependency). There's no component library; small pieces like `AvatarModal.jsx` are the exception, not the rule. When editing a page, expect the whole page (layout, data fetching, forms, modals) in one file — `PanelAnfitrion.jsx` (~790 lines) and `Evento.jsx` (~555 lines) are the largest.

**Routing** is centralized in `src/App.jsx`, which also contains the entire logged-out/logged-in home page (`HomePage`) inline plus global auth state (`user`, `perfil` from the `profiles` table) fed via `supabase.auth.onAuthStateChange`. All routes are declared in one `<Routes>` block there — add new pages both as a file in `src/pages/` and a `<Route>` in `App.jsx`.

**Supabase is the backend.** `src/supabase.js` creates the client (publishable key is hardcoded there, not a secret — RLS enforces access control). Prefer `getUserSafe()` from that file over raw `supabase.auth.getUser()` for anything that gates page rendering: `getUser()` makes a network round-trip with no built-in timeout and can hang a page in a loading state indefinitely (especially right after a mobile app resumes from background); `getUserSafe()` races it against a short timeout and falls back to the cached local session.

**Data access pattern:** pages query Supabase tables directly with the JS client (`supabase.from(...).select(...)`), often joined (e.g. `eventos` joined with `profiles` and `boletos`). `@tanstack/react-query` is used for caching/loading state on read queries (see `HomePage`'s `eventos` query in `App.jsx`). Row-Level Security in Postgres is the real authorization boundary, not frontend checks — `es_admin` / `tipo` / `estado_anfitrion` flags on `profiles` gate UI visibility only.

**Privileged operations go through Supabase Edge Functions** (`supabase/functions/*/index.ts`, Deno), called from pages via plain `fetch` to `${VITE_SUPABASE_URL}/functions/v1/<name>` with the user's JWT as a Bearer token — not `supabase.functions.invoke`. Each function creates its own `service_role` Supabase client server-side. Use an edge function (not a direct table write) whenever an operation needs to: touch a secret (Mercado Pago host token, refunds), act across a permission boundary (host approving/rejecting another user's ticket request), or needs custom rate limiting — functions manually rate-limit via a `rate_limits` table (see `crear-pago-mp` and `gestionar-solicitud` for the pattern: count rows in the last hour window, insert one row per call, reject over a threshold).

Current functions: `crear-pago-mp` (creates an MP checkout preference, looks up the host's `mp_access_token`, applies a 10% marketplace fee), `gestionar-solicitud` (host approves/rejects a requested ticket, triggers MP refund on reject), `cancelar-evento`, `eliminar-cuenta`, `guardar-resena`, `reportar-evento`, `resolver-reporte`, `mp-oauth` (OAuth flow for hosts connecting their Mercado Pago account).

Note: `supabase/config.toml` still lists old function names (`crear-preferencia`, `webhook-pago`, `crear-pago-stripe`, `stripe-connect-onboarding`) that no longer exist under `supabase/functions/` — the project migrated from Stripe to Mercado Pago as the payment processor; Stripe packages remain in `package.json` but are unused in `src/`. Don't assume `config.toml`'s function list is authoritative — check the `functions/` directory instead.

**Payments:** Mercado Pago only (despite Stripe SDKs still installed). Two ticket flows exist per event (`tipo_boleto`): `instantaneo` (ticket activates immediately on payment) vs solicitud/request-based (host must approve via `gestionar-solicitud` before the ticket is `activo`). Boleto states include `activo`, `rechazado`, and pending/requested states — check `boletos.estado` before assuming a ticket is valid.

**Env vars** (`.env`, Vite-prefixed): `VITE_STRIPE_PUBLIC_KEY`, `VITE_MP_CLIENT_ID`, `VITE_SUPABASE_URL`. Edge functions use their own Deno env vars (`SUPABASE_URL`, `SERVICE_ROLE_KEY`, `MP_ACCESS_TOKEN`, `MP_CLIENT_ID`, `SITE_URL`) configured in the Supabase project, not `.env`.

**Language:** all UI copy, route paths, DB table/column names, and most code comments are in Spanish (e.g. `/mis-boletos`, `eventos`, `boletos`, `anfitrion`). Keep new code consistent with this — don't introduce English table/column names or route paths.

## Cómo trabajar conmigo

- Soy principiante en programación, aprendo haciendo. Explica en términos simples cuando algo sea complejo.
- Para cambios pequeños en un archivo: dame el texto EXACTO a buscar con Ctrl+F y el texto EXACTO con el que reemplazarlo.
- Si el cambio es grande o riesgoso: dame el archivo completo para reemplazar con Ctrl+A.
- Cuando se necesite hacer push: dame los 3 comandos juntos (git add . / git commit -m "mensaje" / git push).
- Nunca me mandes a revisar logs de Supabase, tablas del dashboard, ni Network del navegador como primer paso de diagnóstico.
- Todo el testing se hace en producción (eventapp-flax.vercel.app), salvo que diga lo contrario.
- Cuidado especial con corchetes al escribir código — ha habido errores por corchetes mal cerrados.
- k6 se corre con: & "C:\Program Files\k6\k6.exe" run loadtest/test.js
- La extensión de Deno ya está instalada en VS Code.
- Los archivos deno.json deben ser UTF-8 (no UTF-16 LE) para que el deploy funcione.
- Docker no está corriendo pero los deploys de Supabase funcionan igual con el warning.

## Cuentas de prueba

- Admin: panel.admin2026eventapp@gmail.com
- Host de prueba: zoriro.shop@gmail.com
- Mi cuenta (aldodrc2007@gmail.com) NO se puede usar como host.

## Estado actual / pendientes

- Sistema de check-in: quedó a medias en la última sesión, falta terminar la implementación.
- (Agrega aquí cualquier otro pendiente que tengas en mente)