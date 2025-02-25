-- whether the user has verified their email address
ALTER TABLE public."user" ADD COLUMN "email_verified" boolean NOT NULL DEFAULT false;
