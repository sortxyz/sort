
ALTER TABLE public."connection" ADD COLUMN "readonly_connection_id" uuid NULL;
ALTER TABLE public."connection" ADD CONSTRAINT
    fk_connection_readonly_connection_id FOREIGN KEY ("readonly_connection_id") REFERENCES public."connection"(id) ON UPDATE CASCADE;

CREATE INDEX connection_readonly_connection_id ON public."connection" USING btree ("readonly_connection_id");
