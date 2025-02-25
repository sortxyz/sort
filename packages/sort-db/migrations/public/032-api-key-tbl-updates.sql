ALTER TABLE public.user_api_key ADD COLUMN "id" uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.user_api_key DROP CONSTRAINT "user_api_key_pkey";
ALTER TABLE public.user_api_key ADD PRIMARY KEY (id);

ALTER TABLE public.user_api_key ADD COLUMN "hash" varchar(256) NOT NULL DEFAULT '';
ALTER TABLE public.user_api_key ADD COLUMN "summary" varchar(256) NULL;
ALTER TABLE public.user_api_key ADD COLUMN "created_at" timestamp NOT NULL DEFAULT now();
ALTER TABLE public.user_api_key ADD COLUMN "updated_at" timestamp NOT NULL DEFAULT now();
