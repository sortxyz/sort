CREATE TABLE "change_request_change" (
    "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    "change_request_id" UUID NOT NULL,
    "index" INTEGER NOT NULL,
    "action" VARCHAR(10) NOT NULL, -- ADD, MODIFY, DELETE
    "connection_id" UUID NOT NULL,
    "metadata_database_name" VARCHAR(2000) NOT NULL,
    "metadata_table_name" VARCHAR(2000) NOT NULL,
    "metadata_schema_name" VARCHAR(2000) NOT NULL,
    CONSTRAINT "fk_change_request_change_change_request_id" FOREIGN KEY ("change_request_id") REFERENCES "change_request" ("id") ON DELETE CASCADE,
    CONSTRAINT "fk_change_request_change_connection_id" FOREIGN KEY ("connection_id") REFERENCES "connection" ("id") ON DELETE CASCADE,
    CONSTRAINT "fk_change_request_change_metadata_table_name" FOREIGN KEY ("metadata_table_name", "metadata_schema_name", "metadata_database_name", "connection_id") REFERENCES "metadata_table" ("raw_name", "raw_schema_name", "raw_database_name", "connection_id") ON DELETE CASCADE
);

-- This stores the row selection criterion for one keypair value in a singular change.
CREATE TABLE "change_request_primary_key" (
    "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    "change_request_change_id" UUID NOT NULL,
    "column_name" VARCHAR(2000) NOT NULL,
    "string_value" TEXT NULL,
    "numeric_value" NUMERIC NULL,
    "date_value" TIMESTAMP NULL,
    "boolean_value" BOOLEAN NULL,
    "no_string_quotes" BOOLEAN NOT NULL DEFAULT FALSE,
    "json_value" JSONB NULL,
    CONSTRAINT "fk_change_request_primary_key_change_request_change_id" FOREIGN KEY ("change_request_change_id") REFERENCES "change_request_change" ("id") ON DELETE CASCADE
);

-- This stores the row updated/inserted values for one keypair value in a singular change.
CREATE TABLE "change_request_field_value" (
    LIKE "change_request_primary_key" INCLUDING ALL,
    "is_value_null" BOOLEAN NOT NULL
);
