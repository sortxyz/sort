CREATE SCHEMA "test";

CREATE TABLE IF NOT EXISTS test."change_request_test" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "test_uuid" UUID NULL,
  "test_numeric" NUMERIC NULL,
  "test_boolean" BOOLEAN NULL,
  "test_jsonb" JSONB NULL,
  "test_text" TEXT NULL,
  "test_timestamp" TIMESTAMP NULL
);
