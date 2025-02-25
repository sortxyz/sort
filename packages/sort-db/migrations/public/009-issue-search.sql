
CREATE INDEX issue_title_text_search ON public.issue USING gin (to_tsvector('english'::regconfig, (title)::text));
CREATE INDEX issue_description_text_search ON public.issue USING gin (to_tsvector('english'::regconfig, (description)::text));
