-- OTOP Mae Hong Son 2570 v2.7 - additional, verified One Page product fields.
-- Requires existing public.products, public.admins, and public.is_otop_admin() from earlier releases.
-- This does not modify the original product table or existing image URLs.
CREATE TABLE IF NOT EXISTS public.otop_product_report_details (
 product_id bigint PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
 village text NOT NULL DEFAULT '',
 subdistrict text NOT NULL DEFAULT '',
 highlights text NOT NULL DEFAULT '',
 ingredients text NOT NULL DEFAULT '',
 process text NOT NULL DEFAULT '',
 benefits text NOT NULL DEFAULT '',
 usage text NOT NULL DEFAULT '',
 size_weight text NOT NULL DEFAULT '',
 packaging text NOT NULL DEFAULT '',
 certifications text NOT NULL DEFAULT '',
 awards text NOT NULL DEFAULT '',
 report_note text NOT NULL DEFAULT '',
 reporter text NOT NULL DEFAULT '',
 report_headline text NOT NULL DEFAULT '',
 report_theme text NOT NULL DEFAULT 'official' CHECK(report_theme IN ('official','showcase')),
 report_accent text NOT NULL DEFAULT '#195445',
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.otop_product_report_details ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.otop_product_report_details FROM PUBLIC;
REVOKE ALL ON TABLE public.otop_product_report_details FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.otop_product_report_details TO authenticated;
DROP POLICY IF EXISTS "otop report details admin select" ON public.otop_product_report_details;
DROP POLICY IF EXISTS "otop report details admin insert" ON public.otop_product_report_details;
DROP POLICY IF EXISTS "otop report details admin update" ON public.otop_product_report_details;
CREATE POLICY "otop report details admin select" ON public.otop_product_report_details
 FOR SELECT TO authenticated USING ((SELECT public.is_otop_admin()));
CREATE POLICY "otop report details admin insert" ON public.otop_product_report_details
 FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_otop_admin()) AND updated_by = (SELECT auth.uid()));
CREATE POLICY "otop report details admin update" ON public.otop_product_report_details
 FOR UPDATE TO authenticated USING ((SELECT public.is_otop_admin()))
 WITH CHECK ((SELECT public.is_otop_admin()) AND updated_by = (SELECT auth.uid()));
CREATE INDEX IF NOT EXISTS otop_report_updated_at_idx ON public.otop_product_report_details(updated_at DESC);
