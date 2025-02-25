ALTER TABLE "change_request_comment" DROP CONSTRAINT "fk_change_request_comment_change_id";
ALTER TABLE "change_request_comment" ADD CONSTRAINT "fk_change_request_comment_change_id" FOREIGN KEY ("change_id") REFERENCES public."change" ("id") ON DELETE CASCADE;
