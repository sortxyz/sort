
CREATE TABLE IF NOT EXISTS test."change_request_test_required_unknown_fields" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "test_numeric" NUMERIC NULL,
  "test_bytea" BYTEA NOT NULL,
  "test_bit" BIT NULL
);

CREATE TABLE IF NOT EXISTS test."change_request_test_no_primary_keys" (
  "not_id" UUID NOT NULL,
  "test_bytea" BYTEA NOT NULL
);