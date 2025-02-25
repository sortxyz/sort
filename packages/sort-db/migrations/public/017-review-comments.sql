-- NOTE: change_request_comment table originally declared in migration 011

-- Add two new foreign keys to change_request_comment table
ALTER TABLE public."change_request_comment"
  ADD COLUMN "change_id" UUID,
  ADD COLUMN "review_id" UUID,
  ADD CONSTRAINT "fk_change_request_comment_change_id" FOREIGN KEY ("change_id") REFERENCES public."change" ("id"),
  ADD CONSTRAINT "fk_change_request_comment_review_id" FOREIGN KEY ("review_id") REFERENCES public."review" ("id");

-- In migration 011, change_request_id is already a foreign key pointing to change_request.id, but has no index
CREATE INDEX "change_request_comment_change_request_id" ON public."change_request_comment" USING btree ("change_request_id");
CREATE INDEX "change_request_comment_change_id" ON public."change_request_comment" USING btree ("change_id");
CREATE INDEX "change_request_comment_review_id" ON public."change_request_comment" USING btree ("review_id");
