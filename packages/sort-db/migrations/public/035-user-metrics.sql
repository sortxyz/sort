
-- the datetime the user accepted the Terms of Use
ALTER TABLE public."user" ADD COLUMN "terms_accepted_at" timestamp NULL;

-- the number of logins
ALTER TABLE public."user" ADD COLUMN "login_count" integer NOT NULL DEFAULT 0;
