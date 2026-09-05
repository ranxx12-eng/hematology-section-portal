-- ============================================================================
-- Migration 066: Add pending_approval task status enum value
-- Must run in its own migration — PG forbids using new enum values in the same transaction.
-- Additive only — does not modify migrations 001–065.
-- ============================================================================

ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'pending_approval' AFTER 'pending_review';
