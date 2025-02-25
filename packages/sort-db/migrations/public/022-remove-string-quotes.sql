ALTER TABLE public."change_primary_key" DROP COLUMN "no_string_quotes";
ALTER TABLE public."change_field_value" DROP COLUMN "no_string_quotes";

-- Add uuid column to tables
ALTER TABLE public."change_primary_key" ADD COLUMN "uuid_value" UUID NULL;
ALTER TABLE public."change_field_value" ADD COLUMN "uuid_value" UUID NULL;
