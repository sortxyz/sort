CREATE TABLE public."change_request_job_status" (
    status VARCHAR(10) PRIMARY KEY
);

CREATE TABLE public."change_request_job" (
    "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    "change_request_id" UUID NOT NULL,
    "status" VARCHAR(10) NOT NULL,
    "start_time" timestamp NULL,
    "end_time" timestamp NULL,
    "updated_at" timestamp NOT NULL DEFAULT now(),
    "created_at" timestamp NOT NULL DEFAULT now(),
    "error_message" TEXT NULL,
    "rows_affected" INT NULL,
    CONSTRAINT "fk_change_request_job_status" FOREIGN KEY ("status") REFERENCES public."change_request_job_status" ("status") ON UPDATE CASCADE,
    CONSTRAINT "fk_change_request_job_change_request_id" FOREIGN KEY ("change_request_id") REFERENCES public."change_request" (id) ON DELETE CASCADE
);

INSERT INTO public."change_request_job_status" (status) VALUES ('PENDING');
INSERT INTO public."change_request_job_status" (status) VALUES ('RUNNING');
INSERT INTO public."change_request_job_status" (status) VALUES ('COMPLETED');
INSERT INTO public."change_request_job_status" (status) VALUES ('FAILED');
