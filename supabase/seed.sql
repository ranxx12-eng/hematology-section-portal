-- ============================================================================
-- DEVELOPMENT SEED WRAPPER
-- Supabase CLI loads this file on `supabase db reset` (local only).
-- DO NOT configure this for production Supabase projects.
-- ============================================================================

\echo 'WARNING: Loading development seed with demo PHI-like data. NOT for production.'
\ir seeds/development_seed.sql
