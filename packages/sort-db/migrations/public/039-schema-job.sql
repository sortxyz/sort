do $$
begin

CREATE TABLE IF NOT EXISTS public."job_status" (
    status VARCHAR(10) PRIMARY KEY
);

INSERT INTO "job_status" ("status")
SELECT 'PENDING'
WHERE NOT EXISTS (SELECT 1 FROM "job_status" WHERE "status" = 'PENDING');

INSERT INTO "job_status" ("status")
SELECT 'RUNNING'
WHERE NOT EXISTS (SELECT 1 FROM "job_status" WHERE "status" = 'RUNNING');

INSERT INTO "job_status" ("status")
SELECT 'COMPLETED'
WHERE NOT EXISTS (SELECT 1 FROM "job_status" WHERE "status" = 'COMPLETED');

INSERT INTO "job_status" ("status")
SELECT 'FAILED'
WHERE NOT EXISTS (SELECT 1 FROM "job_status" WHERE "status" = 'FAILED');

CREATE TABLE IF NOT EXISTS public."schema_job" (
  -- standard fields
  "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "status" VARCHAR(10) NOT NULL,
  "start_time" timestamp NULL,
  "end_time" timestamp NULL,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "created_at" timestamp NOT NULL DEFAULT now(),
  "error_message" TEXT NULL,
  -- custom fields
  "connection_id" UUID NOT NULL,
  "user_id" varchar(128) NOT NULL,
  CONSTRAINT "fk_schema_job_status" FOREIGN KEY ("status") REFERENCES public."job_status" ("status") ON UPDATE CASCADE,
	CONSTRAINT "fk_schema_job_user_id" FOREIGN KEY ("user_id") REFERENCES public."user"(id) ON DELETE CASCADE,
  CONSTRAINT "fk_schema_job_connection_id" FOREIGN KEY ("connection_id") REFERENCES public."connection" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS schema_job_status ON public."schema_job" USING btree ("status");
CREATE INDEX IF NOT EXISTS schema_job_connection_id ON public."schema_job" USING btree ("connection_id");

-- update change request jobs to use the new job_status table too
ALTER TABLE public.change_request_job DROP CONSTRAINT IF EXISTS fk_change_request_job_status;
ALTER TABLE public.change_request_job ADD CONSTRAINT fk_change_request_job_status FOREIGN KEY ("status") REFERENCES public."job_status" ("status") ON UPDATE CASCADE;
DROP TABLE IF EXISTS public."change_request_job_status";

commit;
end;
$$;
