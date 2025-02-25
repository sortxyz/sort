
SET search_path TO public;

ALTER TABLE public.query DROP CONSTRAINT IF EXISTS fk_query_connection_id;
ALTER TABLE public.query ADD CONSTRAINT fk_query_connection_id FOREIGN KEY (connection_id) REFERENCES public."connection"(id) ON DELETE CASCADE ON UPDATE CASCADE;
