-- OTOP MHS 2570 v2.8: district officers, province dashboard, approval workflow.
-- Run AFTER v2.3 admin roles and v2.7 One Page migration; must be executed by project owner.
BEGIN;
ALTER TABLE public.admins ADD COLUMN IF NOT EXISTS district text;
ALTER TABLE public.admins DROP CONSTRAINT IF EXISTS otop_admins_role_check;
ALTER TABLE public.admins ADD CONSTRAINT otop_admins_role_check CHECK (role IN ('master_admin','sub_admin','district_officer'));
ALTER TABLE public.admins DROP CONSTRAINT IF EXISTS otop_admins_district_check;
ALTER TABLE public.admins ADD CONSTRAINT otop_admins_district_check CHECK (
  role <> 'district_officer' OR (district IS NOT NULL AND district IN ('เมืองแม่ฮ่องสอน','ปาย','ปางมะผ้า','ขุนยวม','แม่ลาน้อย','แม่สะเรียง','สบเมย'))
);
CREATE INDEX IF NOT EXISTS otop_admin_district_idx ON public.admins(district) WHERE role='district_officer';
CREATE OR REPLACE FUNCTION public.otop_is_editor()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.admins a WHERE a.user_id=(SELECT auth.uid()) AND a.is_active AND a.role IN ('master_admin','sub_admin'));
$$;
CREATE OR REPLACE FUNCTION public.otop_is_district_officer(area text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.admins a WHERE a.user_id=(SELECT auth.uid()) AND a.is_active AND a.role='district_officer' AND a.district=area);
$$;
REVOKE ALL ON FUNCTION public.otop_is_editor() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.otop_is_district_officer(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.otop_is_editor(),public.otop_is_district_officer(text) TO authenticated;
-- Replace previous broad is_otop_admin() policies. District officers must NEVER directly update published products.
DROP POLICY IF EXISTS "visitors can read published products" ON public.products;
DROP POLICY IF EXISTS "admin can insert products" ON public.products;
DROP POLICY IF EXISTS "admin can update products" ON public.products;
DROP POLICY IF EXISTS "admin can delete products" ON public.products;
CREATE POLICY "visitors can read published products" ON public.products FOR SELECT TO anon,authenticated
 USING (is_published = true OR (SELECT public.otop_is_editor()) OR public.otop_is_district_officer(district));
CREATE POLICY "admin can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK ((SELECT public.otop_is_editor()));
CREATE POLICY "admin can update products" ON public.products FOR UPDATE TO authenticated USING ((SELECT public.otop_is_editor())) WITH CHECK ((SELECT public.otop_is_editor()));
CREATE POLICY "admin can delete products" ON public.products FOR DELETE TO authenticated USING ((SELECT public.otop_is_editor()));
-- Approval queue. Officers can only see their district's requests and insert unapproved submissions.
CREATE TABLE IF NOT EXISTS public.otop_district_requests (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 district text NOT NULL CHECK(district IN ('เมืองแม่ฮ่องสอน','ปาย','ปางมะผ้า','ขุนยวม','แม่ลาน้อย','แม่สะเรียง','สบเมย')),
 product_id bigint REFERENCES public.products(id) ON DELETE SET NULL,
 action text NOT NULL CHECK(action IN ('create','update')),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=16000),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 submitted_by uuid NOT NULL REFERENCES auth.users(id),
 submitted_at timestamptz NOT NULL DEFAULT now(),
 reviewed_by uuid REFERENCES auth.users(id),reviewed_at timestamptz,
 review_note text NOT NULL DEFAULT '',published_product_id bigint REFERENCES public.products(id),
 CONSTRAINT request_action_product CHECK ((action='create' AND product_id IS NULL) OR (action='update' AND product_id IS NOT NULL))
);
ALTER TABLE public.otop_district_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.otop_district_requests FROM PUBLIC,anon;
GRANT SELECT,INSERT ON public.otop_district_requests TO authenticated;
CREATE INDEX IF NOT EXISTS otop_district_requests_pending_idx ON public.otop_district_requests(status,submitted_at DESC);
DROP POLICY IF EXISTS "district_requests_select" ON public.otop_district_requests;
DROP POLICY IF EXISTS "district_requests_insert" ON public.otop_district_requests;
CREATE POLICY "district_requests_select" ON public.otop_district_requests FOR SELECT TO authenticated
 USING ((SELECT public.is_otop_master_admin()) OR (submitted_by=(SELECT auth.uid()) AND public.otop_is_district_officer(district)));
CREATE POLICY "district_requests_insert" ON public.otop_district_requests FOR INSERT TO authenticated
 WITH CHECK (status='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL AND review_note='' AND published_product_id IS NULL AND submitted_by=(SELECT auth.uid()) AND public.otop_is_district_officer(district)
  AND ((action='create' AND product_id IS NULL) OR (action='update' AND EXISTS(SELECT 1 FROM public.products p WHERE p.id=product_id AND p.district=otop_district_requests.district))));
-- v2.7 supplementary One Page data scoped to own district for officers.
DROP POLICY IF EXISTS "otop report details admin select" ON public.otop_product_report_details;
DROP POLICY IF EXISTS "otop report details admin insert" ON public.otop_product_report_details;
DROP POLICY IF EXISTS "otop report details admin update" ON public.otop_product_report_details;
CREATE POLICY "otop report details admin select" ON public.otop_product_report_details FOR SELECT TO authenticated
 USING ((SELECT public.otop_is_editor()) OR EXISTS(SELECT 1 FROM public.products p WHERE p.id=product_id AND public.otop_is_district_officer(p.district)));
CREATE POLICY "otop report details admin insert" ON public.otop_product_report_details FOR INSERT TO authenticated
 WITH CHECK (updated_by=(SELECT auth.uid()) AND ((SELECT public.otop_is_editor()) OR EXISTS(SELECT 1 FROM public.products p WHERE p.id=product_id AND public.otop_is_district_officer(p.district))));
CREATE POLICY "otop report details admin update" ON public.otop_product_report_details FOR UPDATE TO authenticated
 USING ((SELECT public.otop_is_editor()) OR EXISTS(SELECT 1 FROM public.products p WHERE p.id=product_id AND public.otop_is_district_officer(p.district)))
 WITH CHECK (updated_by=(SELECT auth.uid()) AND ((SELECT public.otop_is_editor()) OR EXISTS(SELECT 1 FROM public.products p WHERE p.id=product_id AND public.otop_is_district_officer(p.district))));
-- Transactional review. Explicit allowlisted fields: cannot write arbitrary product keys via JSON.
CREATE OR REPLACE FUNCTION public.otop_review_request(p_request_id bigint,p_approve boolean,p_note text DEFAULT '')
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.otop_district_requests%ROWTYPE; v public.products%ROWTYPE; data jsonb; result_id bigint; 
BEGIN
 IF NOT (SELECT public.is_otop_master_admin()) THEN RAISE EXCEPTION 'Only master admin can review requests'; END IF;
 SELECT * INTO q FROM public.otop_district_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR q.status<>'pending' THEN RAISE EXCEPTION 'Request not found or already reviewed'; END IF;
 IF length(coalesce(p_note,''))>500 THEN RAISE EXCEPTION 'Review note too long'; END IF;
 IF NOT p_approve THEN
  UPDATE public.otop_district_requests SET status='rejected',review_note=coalesce(p_note,''),reviewed_by=(SELECT auth.uid()),reviewed_at=now() WHERE id=q.id;
  RETURN NULL;
 END IF;
 data=q.payload;
 IF (data-'name'-'category'-'price'-'unit'-'producer'-'shop'-'description'-'story'-'address'-'phone'-'line'-'facebook'-'image'-'lat'-'lng') <> '{}'::jsonb THEN RAISE EXCEPTION 'Unsupported fields in submission'; END IF;
 IF length(trim(coalesce(data->>'name',''))) NOT BETWEEN 1 AND 160 OR length(trim(coalesce(data->>'producer',''))) NOT BETWEEN 1 AND 180 OR length(trim(coalesce(data->>'shop',''))) NOT BETWEEN 1 AND 180 THEN RAISE EXCEPTION 'Required product fields missing'; END IF;
 IF (data->>'category') NOT IN ('อาหาร','เครื่องดื่ม','ผ้าและเครื่องแต่งกาย','ของใช้ ของตกแต่ง ของที่ระลึก','สมุนไพร') THEN RAISE EXCEPTION 'Invalid category'; END IF;
 IF (data->>'price') !~ '^([0-9]{1,8})(\.[0-9]{1,2})?$' OR (data->>'price')::numeric>10000000 THEN RAISE EXCEPTION 'Invalid price'; END IF;
 IF length(coalesce(data->>'unit',''))>40 OR length(coalesce(data->>'description',''))>3000 OR length(coalesce(data->>'story',''))>3000 OR length(coalesce(data->>'address',''))>400 OR length(coalesce(data->>'phone',''))>30 OR length(coalesce(data->>'line',''))>400 OR length(coalesce(data->>'facebook',''))>400 THEN RAISE EXCEPTION 'Field length exceeded'; END IF;
 IF coalesce(data->>'line','')<>'' AND (data->>'line') !~ '^https://' THEN RAISE EXCEPTION 'Invalid LINE URL'; END IF;
 IF coalesce(data->>'facebook','')<>'' AND (data->>'facebook') !~ '^https://' THEN RAISE EXCEPTION 'Invalid Facebook URL'; END IF;
 IF coalesce(data->>'image','')<>'' AND (data->>'image') !~ '^https://' AND (data->>'image') !~ '^assets/images/[A-Za-z0-9_.-]+\.(webp|png|jpg|jpeg)$' THEN RAISE EXCEPTION 'Invalid image URL'; END IF;
 IF coalesce(data->>'lat','')<>'' OR coalesce(data->>'lng','')<>'' THEN
  IF (data->>'lat') !~ '^(-?[0-9]{1,2}(\.[0-9]{1,9})?)$' OR (data->>'lng') !~ '^(-?[0-9]{1,3}(\.[0-9]{1,9})?)$' OR (data->>'lat')::numeric NOT BETWEEN -90 AND 90 OR (data->>'lng')::numeric NOT BETWEEN -180 AND 180 THEN RAISE EXCEPTION 'Invalid coordinates'; END IF;
 END IF;
 IF q.action='update' THEN
   SELECT * INTO v FROM public.products WHERE id=q.product_id FOR UPDATE;
   IF NOT FOUND OR v.district<>q.district THEN RAISE EXCEPTION 'Product district changed or product removed'; END IF;
   UPDATE public.products SET
    name=data->>'name',category=data->>'category',price=(data->>'price')::numeric,unit=coalesce(nullif(data->>'unit',''),'ชิ้น'),
    producer=data->>'producer',shop=data->>'shop',description=coalesce(data->>'description',''),story=coalesce(data->>'story',''),
    address=coalesce(data->>'address',''),phone=coalesce(data->>'phone',''),line=coalesce(data->>'line',''),facebook=coalesce(data->>'facebook',''),
    image=coalesce(nullif(data->>'image',''),v.image),lat=nullif(data->>'lat','')::double precision,lng=nullif(data->>'lng','')::double precision,updated_at=now()
    WHERE id=q.product_id RETURNING id INTO result_id;
 ELSE
   INSERT INTO public.products(name,category,district,price,unit,producer,shop,description,story,address,phone,line,facebook,image,lat,lng,is_published,featured)
   VALUES (data->>'name',data->>'category',q.district,(data->>'price')::numeric,coalesce(nullif(data->>'unit',''),'ชิ้น'),data->>'producer',data->>'shop',coalesce(data->>'description',''),coalesce(data->>'story',''),coalesce(data->>'address',''),coalesce(data->>'phone',''),coalesce(data->>'line',''),coalesce(data->>'facebook',''),coalesce(data->>'image',''),nullif(data->>'lat','')::double precision,nullif(data->>'lng','')::double precision,false,false)
   RETURNING id INTO result_id;
 END IF;
 UPDATE public.otop_district_requests SET status='approved',review_note=coalesce(p_note,''),reviewed_by=(SELECT auth.uid()),reviewed_at=now(),published_product_id=result_id WHERE id=q.id;
 RETURN result_id;
END $$;
REVOKE ALL ON FUNCTION public.otop_review_request(bigint,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.otop_review_request(bigint,boolean,text) TO authenticated;
COMMIT;
