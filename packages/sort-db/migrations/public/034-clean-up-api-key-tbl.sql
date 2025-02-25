ALTER TABLE public.user_api_key DROP COLUMN "read_only";
ALTER TABLE public.user_api_key DROP COLUMN "api_key";
ALTER TABLE public.user_api_key ALTER COLUMN "hash" DROP DEFAULT;
