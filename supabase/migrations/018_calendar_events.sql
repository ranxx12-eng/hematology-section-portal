-- ============================================================================
-- Hematology Section Portal
-- Migration 018: Calendar Events
-- Production-safe. No seed data.
-- ============================================================================

CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT FALSE,
  event_type TEXT NOT NULL DEFAULT 'meeting'
    CHECK (event_type IN ('meeting', 'training', 'maintenance', 'cap_visit', 'cbahi', 'holiday', 'staff_schedule')),
  location TEXT,
  assigned_to UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT calendar_events_end_after_start CHECK (ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_starts_at ON public.calendar_events(starts_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_type ON public.calendar_events(event_type) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_calendar_events_updated_at BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY calendar_events_select ON public.calendar_events
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.has_permission('calendar.view'));

CREATE POLICY calendar_events_insert ON public.calendar_events
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission('calendar.manage'));

CREATE POLICY calendar_events_update ON public.calendar_events
  FOR UPDATE TO authenticated
  USING (public.has_permission('calendar.manage') AND deleted_at IS NULL)
  WITH CHECK (public.has_permission('calendar.manage'));

CREATE POLICY calendar_events_delete ON public.calendar_events
  FOR DELETE TO authenticated
  USING (public.has_permission('calendar.manage'));
