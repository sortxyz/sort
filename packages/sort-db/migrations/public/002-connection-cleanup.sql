SET search_path TO public;

ALTER TABLE public."connection" RENAME COLUMN "org_id" TO "organization_id";
ALTER TABLE public."connection" ADD CONSTRAINT 
    fk_connection_organization_id FOREIGN KEY ("organization_id") REFERENCES public."organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;


