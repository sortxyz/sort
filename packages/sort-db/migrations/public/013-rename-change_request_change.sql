-- Rename the tables
ALTER TABLE "change_request_change" RENAME TO "change";
ALTER TABLE "change_request_primary_key" RENAME TO "change_primary_key";
ALTER TABLE "change_request_field_value" RENAME TO "change_field_value";

-- Drop the foreign key constraints that reference the to-be-renamed columns/tables
ALTER TABLE "change_primary_key" DROP CONSTRAINT "fk_change_request_primary_key_change_request_change_id";

-- Rename foreign key constraints on the 'change' table
ALTER TABLE "change" RENAME CONSTRAINT "fk_change_request_change_change_request_id" TO "fk_change_change_request_id";
ALTER TABLE "change" RENAME CONSTRAINT "fk_change_request_change_connection_id" TO "fk_change_connection_id";
ALTER TABLE "change" RENAME CONSTRAINT "fk_change_request_change_metadata_table_name" TO "fk_change_metadata_table_name";

-- Drop primary key constraints for all involved tables
ALTER TABLE "change" DROP CONSTRAINT "change_request_change_pkey";
ALTER TABLE "change_primary_key" DROP CONSTRAINT "change_request_primary_key_pkey";
ALTER TABLE "change_field_value" DROP CONSTRAINT "change_request_field_value_pkey";

-- Rename the column in the newly named "change_primary_key" table
ALTER TABLE "change_primary_key" RENAME COLUMN "change_request_change_id" TO "change_id";

-- Rename the column in the 'change_field_value' table
ALTER TABLE "change_field_value" RENAME COLUMN "change_request_change_id" TO "change_id";

-- Recreate primary key constraints for all involved tables
ALTER TABLE "change" ADD CONSTRAINT "change_pkey" PRIMARY KEY ("id");
ALTER TABLE "change_primary_key" ADD CONSTRAINT "change_primary_key_pkey" PRIMARY KEY ("id");
ALTER TABLE "change_field_value" ADD CONSTRAINT "change_field_value_pkey" PRIMARY KEY ("id");

-- Recreate foreign key constraints with updated references
ALTER TABLE "change_primary_key" ADD CONSTRAINT "fk_change_primary_key_change_id" FOREIGN KEY ("change_id") REFERENCES "change" ("id") ON DELETE CASCADE;
ALTER TABLE "change_field_value" ADD CONSTRAINT "fk_change_field_value_change_id" FOREIGN KEY ("change_id") REFERENCES "change" ("id") ON DELETE CASCADE;
