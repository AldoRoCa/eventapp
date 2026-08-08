-- ============================================================================
-- Quitar las columnas muertas de Stripe en profiles
-- ============================================================================
-- El proyecto migró de Stripe a Mercado Pago hace tiempo; los paquetes de
-- Stripe se sacaron de package.json el 2026-07-09 y las funciones fantasma
-- (crear-pago-stripe, stripe-connect-onboarding) se eliminaron del proyecto
-- de Supabase. Estas dos columnas se quedaron atrás.
--
-- Verificado el 2026-08-08: cero referencias a "stripe" en todo el código
-- (frontend, Edge Functions, migraciones). No las lee ni las escribe nadie.
--
-- A propósito NO se usa CASCADE: si alguna vista o restricción dependiera de
-- estas columnas, es mejor que este script falle con un error claro a que se
-- lleve por delante algo sin avisar. Si eso pasara, revisar la dependencia
-- antes de insistir.
-- ============================================================================

alter table public.profiles
  drop column if exists stripe_account_id,
  drop column if exists stripe_customer_id;
