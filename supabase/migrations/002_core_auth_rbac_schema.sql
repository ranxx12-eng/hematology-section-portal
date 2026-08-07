-- ============================================================================
-- Hematology Section Portal
-- Migration 002: Core Auth & RBAC Schema
-- Production-safe. No seed data.
-- ============================================================================

-- RBAC model:
--   roles              = canonical role definitions (source of truth for role identity)
--   permissions        = permission codes
--   role_permissions   = role -> permission mapping
--   profiles.primary_role_id = each user's primary role (FK to roles.id)
--   user_roles         = supplemental roles with expiry
--   app_role enum      = legacy compatibility on roles.name only; not used for auth checks

CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name public.app_role NOT NULL UNIQUE,
  display_name_en TEXT NOT NULL,
  display_name_ar TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  module TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email CITEXT NOT NULL UNIQUE,
  phone TEXT,
  job_title TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'lab_technologist',
  section TEXT NOT NULL DEFAULT 'Hematology',
  hire_date DATE NOT NULL,
  employment_status public.employment_status NOT NULL DEFAULT 'active',
  shift public.shift_type NOT NULL DEFAULT 'morning',
  supervisor_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  profile_photo TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT employees_supervisor_not_self CHECK (supervisor_id IS NULL OR supervisor_id <> id)
);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email CITEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  primary_role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  avatar_url TEXT,
  language public.app_language NOT NULL DEFAULT 'en',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.employees
  ADD CONSTRAINT employees_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_profiles_primary_role_id ON public.profiles(primary_role_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_employee_id ON public.profiles(employee_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_roles_expires_at ON public.user_roles(expires_at) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON public.role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_permissions_code ON public.permissions(code);
