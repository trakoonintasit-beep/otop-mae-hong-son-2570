-- OTOP 2570: publicly visible approximate visit counter, no visitor IP or identity stored.
-- Apply in Supabase > SQL Editor after base setup.sql.
-- Anonymous browsers can call one function per visit. Counts are approximate and can be inflated.
CREATE TABLE IF NOT EXISTS public.otop_site_visits (
  site_id text PRIMARY KEY,
  view_count bigint NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.otop_site_visits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.otop_site_visits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_otop_view_count()
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((SELECT v.view_count FROM public.otop_site_visits AS v WHERE v.site_id = 'otop-mhs-2570'), 0)::bigint;
$$;

CREATE OR REPLACE FUNCTION public.record_otop_view()
RETURNS bigint
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE visits bigint;
BEGIN
  INSERT INTO public.otop_site_visits(site_id,view_count,updated_at)
  VALUES ('otop-mhs-2570',1,now())
  ON CONFLICT (site_id)
  DO UPDATE SET view_count = public.otop_site_visits.view_count + 1, updated_at=now()
  RETURNING view_count INTO visits;
  RETURN visits;
END;
$$;

REVOKE ALL ON FUNCTION public.get_otop_view_count() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_otop_view() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_otop_view_count() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_otop_view() TO anon, authenticated;
