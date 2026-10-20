-- OTOP MHS 2570: master admin / sub-admin roles, incremental migration.
-- Requires the original supabase/setup.sql to have been applied first.
-- Safe to re-run; does not promote any user automatically.

ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'sub_admin',
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS otop_admins_username_unique
  ON public.admins (username) WHERE username IS NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'otop_admins_role_check'
      AND conrelid = 'public.admins'::regclass
  ) THEN
    ALTER TABLE public.admins ADD CONSTRAINT otop_admins_role_check
      CHECK (role IN ('master_admin','sub_admin'));
  END IF;
END $$;

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins can read own membership" ON public.admins;
CREATE POLICY "admins can read own membership" ON public.admins
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Revoked sub-admins must lose all product and image write access,
-- even if they still have an unexpired JWT.
CREATE OR REPLACE FUNCTION public.is_otop_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins AS a
    WHERE a.user_id = (SELECT auth.uid()) AND a.is_active = true
  );
$$;
REVOKE ALL ON FUNCTION public.is_otop_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_otop_admin() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_otop_master_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins AS a
    WHERE a.user_id = (SELECT auth.uid())
      AND a.is_active = true AND a.role = 'master_admin'
  );
$$;
REVOKE ALL ON FUNCTION public.is_otop_master_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_otop_master_admin() TO authenticated;

-- Audit trail: passwords and tokens are NEVER saved here.
CREATE TABLE IF NOT EXISTS public.otop_admin_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('create','reset_password','activate','deactivate')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.otop_admin_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.otop_admin_audit FROM anon, authenticated;

-- BOOTSTRAP ONCE, MANUALLY: Create an authentic Supabase Auth user
-- (Authentication > Users), then run the following statement in SQL Editor
-- AFTER REPLACING the address with that admin's REAL email:
--
-- INSERT INTO public.admins(user_id, role, is_active, display_name)
-- SELECT id, 'master_admin', true, 'Admin หลัก OTOP'
-- FROM auth.users WHERE email = 'REPLACE_WITH_REAL_MASTER_EMAIL'
-- ON CONFLICT (user_id) DO UPDATE
-- SET role='master_admin', is_active=true;
--
-- NEVER run the bootstrap for an unspecified account or on every existing admin.
