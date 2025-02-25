-- Create the 'issue' table
CREATE TABLE public."issue" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "metadata_database_connection_id" UUID NOT NULL,
  "metadata_database_raw_name" VARCHAR(200) NOT NULL,
  "created_by" VARCHAR(128) NOT NULL,
  "issue_number" INT NOT NULL,
  "title" VARCHAR(256) NOT NULL,
  "description" TEXT,
  "status" VARCHAR(128) NOT NULL DEFAULT 'open'::character varying,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "fk_issue_metadata_database" FOREIGN KEY ("metadata_database_connection_id", "metadata_database_raw_name") REFERENCES public."metadata_database"(connection_id, raw_name) ON DELETE CASCADE,
  CONSTRAINT "fk_issue_created_by" FOREIGN KEY ("created_by") REFERENCES public."user"(id)
);

-- Create the 'label' table
CREATE TABLE public."label" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(128) NOT NULL,
  "description" TEXT,
  "color" CHAR(7) NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT "uc_label_name_description_color" UNIQUE ("name", "description", "color"),
  CONSTRAINT "chk_color_hex" CHECK ("color" ~ '^#([A-Fa-f0-9]{6})$')
);

-- Create the 'issue_comment' table
CREATE TABLE public."issue_comment" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "issue_id" UUID NOT NULL,
  "created_by" VARCHAR(128) NOT NULL,
  "content" VARCHAR(500) NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "fk_issue_comment_issue_id" FOREIGN KEY ("issue_id") REFERENCES public."issue"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_issue_comment_created_by" FOREIGN KEY ("created_by") REFERENCES public."user"(id)
);

-- Create a reference table for the action_types of the 'issue_history' table
CREATE TABLE public."issue_action_type" (
    action_type VARCHAR(128) PRIMARY KEY
);

-- Populate the reference table with the permitted action_types
INSERT INTO issue_action_type (action_type) VALUES
  ('CREATE_ISSUE'),
  ('CLOSE_ISSUE'),
  ('REOPEN_ISSUE'),
  ('UPDATE_TITLE'),
  ('UPDATE_DESCRIPTION'),
  ('ADD_LABEL'),
  ('REMOVE_LABEL'),
  ('ADD_ASSIGNEE'),
  ('REMOVE_ASSIGNEE'),
  ('ADD_COMMENT'),
  ('UPDATE_COMMENT'),
  ('REMOVE_COMMENT');

-- Create the 'issue_history' table
CREATE TABLE public."issue_history" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "issue_id" UUID NOT NULL,
  "user_id" VARCHAR(128) NOT NULL,
  "action_type" VARCHAR(128) NOT NULL,
  "action_details" JSONB,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "fk_issue_history_issue_id" FOREIGN KEY ("issue_id") REFERENCES public."issue"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_issue_history_user_id" FOREIGN KEY ("user_id") REFERENCES public."user"("id"),
  CONSTRAINT "fk_issue_history_action_type" FOREIGN KEY ("action_type") REFERENCES public."issue_action_type"("action_type") ON UPDATE CASCADE
);

-- Create the 'issue_label' association table
CREATE TABLE public."issue_label" (
  "issue_id" UUID NOT NULL,
  "label_id" UUID NOT NULL,
  CONSTRAINT "issue_label_pkey" PRIMARY KEY ("issue_id", "label_id"),
  CONSTRAINT "fk_issue_label_issue_id" FOREIGN KEY ("issue_id") REFERENCES public."issue"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_issue_label_label_id" FOREIGN KEY ("label_id") REFERENCES public."label"("id") ON DELETE CASCADE,
  CONSTRAINT "uc_issue_label" UNIQUE ("issue_id", "label_id")
);

-- Create the 'issue_assignee' association table
CREATE TABLE public."issue_assignee" (
  "issue_id" UUID NOT NULL,
  "user_id" VARCHAR(128) NOT NULL,
  CONSTRAINT "issue_assignee_pkey" PRIMARY KEY ("issue_id", "user_id"),
  CONSTRAINT "fk_issue_assignee_issue_id" FOREIGN KEY ("issue_id") REFERENCES public."issue"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_issue_assignee_user_id" FOREIGN KEY ("user_id") REFERENCES public."user"("id") ON DELETE CASCADE,
  CONSTRAINT "uc_issue_assignee" UNIQUE ("issue_id", "user_id")
);

-- Create the 'metadata_database_label' association table
CREATE TABLE public."metadata_database_label" (
  "metadata_database_connection_id" UUID NOT NULL,
  "metadata_database_raw_name" VARCHAR(200) NOT NULL,
  "label_id" UUID NOT NULL,
  CONSTRAINT "metadata_database_label_pkey" PRIMARY KEY ("metadata_database_connection_id", "metadata_database_raw_name", "label_id"),
  CONSTRAINT "fk_metadata_database_label_metadata_database" FOREIGN KEY ("metadata_database_connection_id", "metadata_database_raw_name") REFERENCES public."metadata_database"(connection_id, raw_name) ON DELETE CASCADE,
  CONSTRAINT "fk_metadata_database_label_label_id" FOREIGN KEY ("label_id") REFERENCES public."label"(id) ON DELETE cascade,
  CONSTRAINT "uc_metadata_database_label" UNIQUE ("metadata_database_connection_id", "metadata_database_raw_name", "label_id")
);

-- Create a sequence generator for issue_number per metadata_database
CREATE OR REPLACE FUNCTION issue_number_sequence() RETURNS TRIGGER AS $$
BEGIN
  NEW.issue_number := COALESCE(
    (SELECT MAX(issue_number) + 1 FROM "issue" WHERE "metadata_database_connection_id" = NEW."metadata_database_connection_id" AND "metadata_database_raw_name" = NEW."metadata_database_raw_name"),
    1
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_issue_number BEFORE INSERT ON public."issue"
FOR EACH ROW EXECUTE FUNCTION issue_number_sequence();

-- Indexes for optimization
CREATE INDEX "idx_issue_status" ON public."issue" USING btree ("status");
CREATE INDEX "idx_issue_comment_issue_id" ON public."issue_comment" USING btree ("issue_id");
CREATE INDEX "idx_issue_history_issue_id" ON public."issue_history" USING btree ("issue_id");
CREATE INDEX "idx_issue_history_created_at" ON public."issue_history" USING btree ("created_at");
CREATE INDEX "idx_issue_label_issue_id" ON public."issue_label" USING btree ("issue_id");
CREATE INDEX "idx_issue_label_label_id" ON public."issue_label" USING btree ("label_id");
CREATE INDEX "idx_issue_metadata_database" ON public."issue" USING btree ("metadata_database_connection_id", "metadata_database_raw_name");
CREATE INDEX "idx_issue_assignee_issue_id" ON public."issue_assignee" USING btree ("issue_id");
CREATE INDEX "idx_issue_assignee_user_id" ON public."issue_assignee" USING btree ("user_id");
CREATE INDEX "idx_metadata_database_label_metadata_database" ON public."metadata_database_label" USING btree ("metadata_database_connection_id", "metadata_database_raw_name");
CREATE INDEX "idx_metadata_database_label_label_id" ON public."metadata_database_label" USING btree ("label_id");
CREATE INDEX "idx_label_is_default" ON public."label" USING btree ("is_default");
