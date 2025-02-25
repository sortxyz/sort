--DROP SCHEMA public;

CREATE SCHEMA public AUTHORIZATION postgres;

REVOKE ALL ON SCHEMA pg_catalog, information_schema, public FROM PUBLIC;

CREATE EXTENSION pg_trgm;

SET search_path TO public;

-- tables/indices

CREATE TABLE public.query_type (
	"type" varchar(32) NOT NULL,
	CONSTRAINT query_type_pkey PRIMARY KEY (type)
);

CREATE TABLE public."role" (
	id smallserial NOT NULL,
	"name" varchar(128) NOT NULL,
	CONSTRAINT role_pkey PRIMARY KEY (id),
	CONSTRAINT unique_name UNIQUE (name)
);

CREATE TABLE public."user" (
	id varchar(128) NOT NULL,
	username varchar(128) NOT NULL,
	username_discord varchar(128) NULL,
	stripe_customer_id varchar(32) NULL,
	stripe_subscription varchar(32) NULL,
	administrator bool NOT NULL DEFAULT false,
	"name" varchar(256) NULL,
	email varchar(1024) NULL,
	picture varchar(1024) NULL,
	CONSTRAINT user_pkey PRIMARY KEY (id),
	CONSTRAINT user_username_key UNIQUE (username)
);
CREATE INDEX user_username ON public."user" USING btree (username);

CREATE TABLE public."connection" (
	id uuid NOT NULL DEFAULT gen_random_uuid(),
	org_id uuid NOT NULL,
	data_provider varchar(64) NOT NULL,
	connection_string varchar(1024) NOT NULL,
	created_by varchar(64) NOT NULL,
	created_at timestamp NOT NULL,
	"name" varchar(128) NOT NULL,
	with_ssl bool NOT NULL DEFAULT false,
	warehouse varchar(1024) NULL,
	visibility varchar(128) NOT NULL,
	CONSTRAINT connection_pkey PRIMARY KEY (id),
	CONSTRAINT fk_connection_created_by FOREIGN KEY (created_by) REFERENCES public."user"(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX connection_org_id ON public.connection USING btree (org_id);

CREATE TABLE public.metadata_database (
	connection_id uuid NOT NULL,
	organization_id uuid NOT NULL,
	raw_name varchar(200) NOT NULL,
	display_name varchar(500) NULL,
	slug varchar(200) NOT NULL,
	summary text NULL,
	description text NULL,
	link varchar(512) NULL,
	CONSTRAINT metadata_database_pkey PRIMARY KEY (organization_id, slug),
	CONSTRAINT connection_id_raw_name UNIQUE("connection_id", "raw_name"),
	CONSTRAINT fk_metadata_database_connection_id FOREIGN KEY (connection_id) REFERENCES public."connection"(id) ON DELETE CASCADE
);

CREATE TABLE public.metadata_table (
	connection_id uuid NOT NULL,
	raw_database_name varchar(200) NOT NULL,
	raw_schema_name varchar(200) NOT NULL,
	raw_name varchar(200) NOT NULL,
	display_name varchar(200) NULL,
	summary varchar(200) NULL,
	CONSTRAINT metadata_table_pkey PRIMARY KEY (connection_id, raw_database_name, raw_schema_name, raw_name),
	CONSTRAINT fk_metadata_table_connection_id FOREIGN KEY (connection_id) REFERENCES public."connection"(id) ON DELETE CASCADE
);

CREATE TABLE public.organization (
	id uuid NOT NULL DEFAULT gen_random_uuid(),
	"name" varchar(128) NOT NULL,
	slug varchar(128) NOT NULL,
	description text NULL,
	link varchar(512) NULL,
	created_by varchar(64) NOT NULL,
	created_at timestamp NOT NULL,
	CONSTRAINT organization_pkey PRIMARY KEY (id),
	CONSTRAINT organization_slug_key UNIQUE (slug),
	CONSTRAINT fk_organization_created_by FOREIGN KEY (created_by) REFERENCES public."user"(id)
);
CREATE INDEX organization_name_text_search ON public.organization USING gin (to_tsvector('english'::regconfig, (name)::text));

CREATE TABLE public.organization_invite (
	id uuid NOT NULL DEFAULT gen_random_uuid(),
	created_at timestamp NOT NULL DEFAULT now(),
	created_by varchar(64) NOT NULL,
	email varchar(128) NOT NULL,
	"name" varchar(128) NOT NULL,
	organization_id uuid NOT NULL,
	role_id smallserial NOT NULL,
	status varchar(128) NOT NULL DEFAULT 'pending'::character varying,
	CONSTRAINT organization_invite_email_organization_id_key UNIQUE (email, organization_id),
	CONSTRAINT organization_invite_pkey PRIMARY KEY (id),
	CONSTRAINT fk_organization_invite_created_by FOREIGN KEY (created_by) REFERENCES public."user"(id) ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT fk_organization_invite_organization_id FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT fk_organization_invite_role_id FOREIGN KEY (role_id) REFERENCES public."role"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE public.organization_user (
	user_id varchar(64) NOT NULL,
	organization_id uuid NOT NULL,
	role_id smallserial NOT NULL,
	CONSTRAINT organization_user_pkey PRIMARY KEY (user_id, organization_id),
	CONSTRAINT fk_organization_user_organization_id FOREIGN KEY (organization_id) REFERENCES public.organization(id),
	CONSTRAINT fk_organization_user_role_id FOREIGN KEY (role_id) REFERENCES public."role"(id),
	CONSTRAINT fk_organization_user_user_id FOREIGN KEY (user_id) REFERENCES public."user"(id)
);
CREATE INDEX organization_user_organization_id ON public.organization_user USING btree (organization_id);

CREATE TABLE public.query (
	id uuid NOT NULL DEFAULT gen_random_uuid(),
	"type" varchar(32) NOT NULL,
	"sql" text NULL,
	intent jsonb NULL,
	connection_id uuid NOT NULL,
	database_name varchar(200) NOT NULL,
	"name" varchar(128) NULL,
	description text NULL,
	created_by varchar(64) NOT NULL,
	created_at timestamp NOT NULL DEFAULT now(),
	updated_at timestamp NOT NULL DEFAULT now(),
	CONSTRAINT query_pkey PRIMARY KEY (id),
	CONSTRAINT fk_query_connection_id FOREIGN KEY (connection_id) REFERENCES public."connection"(id),
	CONSTRAINT fk_query_created_by FOREIGN KEY (created_by) REFERENCES public."user"(id) ON UPDATE CASCADE,
	CONSTRAINT query_type_fkey FOREIGN KEY ("type") REFERENCES public.query_type("type") ON UPDATE CASCADE
);

CREATE TABLE public."snapshot" (
	id uuid NOT NULL DEFAULT gen_random_uuid(),
	connection_id uuid NOT NULL,
	creator varchar(64) NOT NULL,
	"timestamp" timestamp NOT NULL,
	status varchar(32) NOT NULL,
	CONSTRAINT snapshot_pkey PRIMARY KEY (id),
	CONSTRAINT fk_snapshot_connection_id FOREIGN KEY (connection_id) REFERENCES public."connection"(id) ON DELETE CASCADE
);
CREATE INDEX snapshot_connection_id ON public.snapshot USING btree (connection_id);

CREATE TABLE public.snapshot_database (
	id uuid NOT NULL DEFAULT gen_random_uuid(),
	snapshot_id uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	CONSTRAINT snapshot_database_pkey PRIMARY KEY (id),
	CONSTRAINT fk_snapshot_database_snapshot_id FOREIGN KEY (snapshot_id) REFERENCES public."snapshot"(id) ON DELETE CASCADE
);
CREATE INDEX snapshot_database_name_text_search ON public.snapshot_database USING gin (to_tsvector('english'::regconfig, (name)::text));
CREATE INDEX snapshot_database_snapshot_id ON public.snapshot_database USING btree (snapshot_id);

CREATE TABLE public.snapshot_schema (
	id uuid NOT NULL DEFAULT gen_random_uuid(),
	database_id uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	CONSTRAINT snapshot_schema_pkey PRIMARY KEY (id),
	CONSTRAINT fk_snapshot_schema_database_id FOREIGN KEY (database_id) REFERENCES public.snapshot_database(id) ON DELETE CASCADE
);
CREATE INDEX snapshot_schema_database_id ON public.snapshot_schema USING btree (database_id);

CREATE TABLE public.snapshot_table (
	id uuid NOT NULL DEFAULT gen_random_uuid(),
	schema_id uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	CONSTRAINT snapshot_table_pkey PRIMARY KEY (id),
	CONSTRAINT fk_snapshot_table_schema_id FOREIGN KEY (schema_id) REFERENCES public.snapshot_schema(id) ON DELETE CASCADE
);
CREATE INDEX snapshot_table_name_text_search ON public.snapshot_table USING gin (to_tsvector('english'::regconfig, (name)::text));
CREATE INDEX snapshot_table_schema_id ON public.snapshot_table USING btree (schema_id);

CREATE TABLE public.user_api_key (
	user_id varchar(128) NOT NULL,
	api_key uuid NOT NULL DEFAULT gen_random_uuid(),
	read_only bool NOT NULL DEFAULT true,
	CONSTRAINT user_api_key_pkey PRIMARY KEY (user_id, api_key),
	CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE
);

CREATE TABLE public.snapshot_column (
	id uuid NOT NULL DEFAULT gen_random_uuid(),
	table_id uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"type" varchar(100) NOT NULL,
	"position" int4 NOT NULL,
	"nullable" bool NOT NULL,
	CONSTRAINT snapshot_column_pkey PRIMARY KEY (id),
	CONSTRAINT fk_snapshot_column_table_id FOREIGN KEY (table_id) REFERENCES public.snapshot_table(id) ON DELETE CASCADE
);

-- inserts (core db setup)
INSERT INTO "role" ("id", "name")
SELECT 0, 'owner'
WHERE NOT EXISTS (SELECT 1 FROM "role" WHERE "id" = 0);

INSERT INTO "role" ("id", "name")
SELECT 1, 'member'
WHERE NOT EXISTS (SELECT 1 FROM "role" WHERE "id" = 1);

INSERT INTO query_type (type)
SELECT 'intent'
WHERE NOT EXISTS (SELECT 1 FROM query_type WHERE type = 'intent');

INSERT INTO query_type (type)
SELECT 'sql'
WHERE NOT EXISTS (SELECT 1 FROM query_type WHERE type = 'sql');

-- set max connections to match RDS development environment
ALTER SYSTEM SET max_connections = 832;
