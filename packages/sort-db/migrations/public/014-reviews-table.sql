CREATE TABLE public.review_event_type (
    event_type VARCHAR(32) PRIMARY KEY
);

INSERT INTO review_event_type (event_type) VALUES
  ('APPROVE'),
  ('COMMENT');

CREATE TABLE public."review" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "change_request_id" UUID NOT NULL,
  "event_type" VARCHAR(32) NOT NULL,
  "text" TEXT,
  "created_by" VARCHAR(128) NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "fk_review_change_request_id" FOREIGN KEY ("change_request_id") REFERENCES public."change_request" (id) ON DELETE CASCADE,
  CONSTRAINT "fk_review_created_by" FOREIGN KEY ("created_by") REFERENCES public."user"(id),
  CONSTRAINT "fk_review_event__type" FOREIGN KEY ("event_type") REFERENCES public."review_event_type"("event_type") ON UPDATE CASCADE
);

INSERT INTO change_request_action_type (action_type) VALUES
  ('ADD_REVIEW'),
  ('UPDATE_REVIEW'),
  ('REMOVE_REVIEW');
