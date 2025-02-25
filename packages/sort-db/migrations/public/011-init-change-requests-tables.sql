-- Create the 'change_request' table
CREATE TABLE public."change_request" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "metadata_database_connection_id" UUID NOT NULL,
  "metadata_database_raw_name" VARCHAR(200) NOT NULL,
  "created_by" VARCHAR(128) NOT NULL,
  "change_request_number" INT NOT NULL,
  "title" VARCHAR(256) NOT NULL,
  "description" TEXT,
  "status" VARCHAR(128) NOT NULL DEFAULT 'open'::character varying,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "fk_change_request_metadata_database" FOREIGN KEY ("metadata_database_connection_id", "metadata_database_raw_name") REFERENCES public."metadata_database"(connection_id, raw_name) ON DELETE CASCADE,
  CONSTRAINT "fk_change_request_created_by" FOREIGN KEY ("created_by") REFERENCES public."user"(id)
);

-- Create the 'change_request_comment' table
CREATE TABLE public."change_request_comment" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "change_request_id" UUID NOT NULL,
  "created_by" VARCHAR(128) NOT NULL,
  "content" VARCHAR(500) NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "fk_change_request_comment_change_request_id" FOREIGN KEY ("change_request_id") REFERENCES public."change_request"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_change_request_comment_created_by" FOREIGN KEY ("created_by") REFERENCES public."user"(id)
);

-- Create a reference table for the action_types of the 'change_request_history' table
CREATE TABLE public."change_request_action_type" (
    action_type VARCHAR(128) PRIMARY KEY
);

-- Populate the reference table with the permitted action_types
INSERT INTO change_request_action_type (action_type) VALUES
  ('CREATE_CHANGE_REQUEST'),
  ('CLOSE_CHANGE_REQUEST'),
  ('REOPEN_CHANGE_REQUEST'),
  ('UPDATE_TITLE'),
  ('UPDATE_DESCRIPTION'),
  ('ADD_LABEL'),
  ('REMOVE_LABEL'),
  ('ADD_REVIEWER'),
  ('REMOVE_REVIEWER'),
  ('ADD_ISSUE'),
  ('REMOVE_ISSUE'),
  ('ADD_COMMENT'),
  ('UPDATE_COMMENT'),
  ('REMOVE_COMMENT');

-- Create the 'change_request_history' table
CREATE TABLE public."change_request_history" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "change_request_id" UUID NOT NULL,
  "user_id" VARCHAR(128) NOT NULL,
  "action_type" VARCHAR(128) NOT NULL,
  "action_details" JSONB NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "fk_change_request_history_change_request_id" FOREIGN KEY ("change_request_id") REFERENCES public."change_request"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_change_request_history_user_id" FOREIGN KEY ("user_id") REFERENCES public."user"("id"),
  CONSTRAINT "fk_change_request_history_action_type" FOREIGN KEY ("action_type") REFERENCES public."change_request_action_type"("action_type") ON UPDATE CASCADE
);

-- Create the 'change_request_label' association table
CREATE TABLE public."change_request_label" (
  "change_request_id" UUID NOT NULL,
  "label_id" UUID NOT NULL,
  CONSTRAINT "change_request_label_pkey" PRIMARY KEY ("change_request_id", "label_id"),
  CONSTRAINT "fk_change_request_label_change_request_id" FOREIGN KEY ("change_request_id") REFERENCES public."change_request"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_change_request_label_label_id" FOREIGN KEY ("label_id") REFERENCES public."label"("id") ON DELETE CASCADE
);

-- Create the 'change_request_reviewer' association table
CREATE TABLE public."change_request_reviewer" (
  "change_request_id" UUID NOT NULL,
  "user_id" VARCHAR(128) NOT NULL,
  CONSTRAINT "change_request_reviewer_pkey" PRIMARY KEY ("change_request_id", "user_id"),
  CONSTRAINT "fk_change_request_reviewer_change_request_id" FOREIGN KEY ("change_request_id") REFERENCES public."change_request"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_change_request_reviewer_user_id" FOREIGN KEY ("user_id") REFERENCES public."user"("id") ON DELETE CASCADE
);

-- Create the 'change_request_issue' association table
CREATE TABLE public."change_request_issue" (
  "change_request_id" UUID NOT NULL,
  "issue_id" UUID NOT NULL,
  CONSTRAINT "change_request_issue_pkey" PRIMARY KEY ("change_request_id", "issue_id"),
  CONSTRAINT "fk_change_request_issue_change_request_id" FOREIGN KEY ("change_request_id") REFERENCES public."change_request"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_change_request_issue_issue_id" FOREIGN KEY ("issue_id") REFERENCES public."issue"("id") ON DELETE CASCADE
);

-- Create a sequence generator for change_request_number per metadata_database
CREATE OR REPLACE FUNCTION change_request_number_sequence() RETURNS TRIGGER AS $$
BEGIN
  NEW.change_request_number := COALESCE(
    (SELECT MAX(change_request_number) + 1 FROM "change_request" WHERE "metadata_database_connection_id" = NEW."metadata_database_connection_id" AND "metadata_database_raw_name" = NEW."metadata_database_raw_name"),
    1
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_change_request_number BEFORE INSERT ON public."change_request"
FOR EACH ROW EXECUTE FUNCTION change_request_number_sequence();

-- Indexes for optimization
CREATE INDEX "idx_change_request_status" ON public."change_request" USING btree ("status");
CREATE INDEX "idx_change_request_comment_change_request_id" ON public."change_request_comment" USING btree ("change_request_id");
CREATE INDEX "idx_change_request_history_change_request_id" ON public."change_request_history" USING btree ("change_request_id");
CREATE INDEX "idx_change_request_history_created_at" ON public."change_request_history" USING btree ("created_at");
CREATE INDEX "idx_change_request_label_change_request_id" ON public."change_request_label" USING btree ("change_request_id");
CREATE INDEX "idx_change_request_label_label_id" ON public."change_request_label" USING btree ("label_id");
CREATE INDEX "idx_change_request_metadata_database" ON public."change_request" USING btree ("metadata_database_connection_id", "metadata_database_raw_name");
CREATE INDEX "idx_change_request_reviewer_change_request_id" ON public."change_request_reviewer" USING btree ("change_request_id");
CREATE INDEX "idx_change_request_reviewer_user_id" ON public."change_request_reviewer" USING btree ("user_id");

-- Indexes for search
CREATE INDEX change_request_title_text_search ON public.change_request USING gin (to_tsvector('english'::regconfig, (title)::text));
CREATE INDEX change_request_description_text_search ON public.change_request USING gin (to_tsvector('english'::regconfig, (description)::text));
