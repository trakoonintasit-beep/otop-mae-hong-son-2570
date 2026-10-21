-- v2.9 Premium gallery: optional image URLs pointing to already registered Google Drive media.
ALTER TABLE public.otop_product_report_details ADD COLUMN IF NOT EXISTS secondary_image_1 text NOT NULL DEFAULT '';
ALTER TABLE public.otop_product_report_details ADD COLUMN IF NOT EXISTS secondary_image_2 text NOT NULL DEFAULT '';
ALTER TABLE public.otop_product_report_details DROP CONSTRAINT IF EXISTS otop_gallery_url_check;
ALTER TABLE public.otop_product_report_details ADD CONSTRAINT otop_gallery_url_check CHECK (
 (secondary_image_1='' OR (secondary_image_1 ~ '^https://' AND length(secondary_image_1)<=600)) AND
 (secondary_image_2='' OR (secondary_image_2 ~ '^https://' AND length(secondary_image_2)<=600))
);
