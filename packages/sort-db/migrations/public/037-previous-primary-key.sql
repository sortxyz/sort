CREATE TABLE "change_previous_primary_key" (
    LIKE "change_primary_key" INCLUDING ALL
);

ALTER TABLE "change_previous_primary_key" RENAME CONSTRAINT "change_primary_key_pkey" TO "change_previous_primary_key_pkey";

ALTER TABLE "change_previous_primary_key" ADD CONSTRAINT "fk_change_previous_primary_key_change_id" FOREIGN KEY ("change_id") REFERENCES "change" ("id") ON DELETE CASCADE;


-- Create new test tables
CREATE TABLE IF NOT EXISTS test."change_request_test_all_primary_keys" (
  "id" UUID,
  "numeric_id" NUMERIC,
  "boolean_id" BOOLEAN,
  "jsonb_id" JSONB,
  "timestamp_id" TIMESTAMP,
  "binary_id" BYTEA,
  PRIMARY KEY ("id", "numeric_id", "boolean_id", "jsonb_id", "timestamp_id", "binary_id")
);