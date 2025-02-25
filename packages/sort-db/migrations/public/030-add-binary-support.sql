ALTER TABLE "public"."change_field_value" ADD COLUMN "binary_value" BYTEA NULL;
ALTER TABLE "public"."change_previous_field_value" ADD COLUMN "binary_value" BYTEA NULL;
ALTER TABLE "public"."change_primary_key" ADD COLUMN "binary_value" BYTEA NULL;
ALTER TABLE "test"."change_request_test" ADD COLUMN "test_binary" BYTEA NULL;