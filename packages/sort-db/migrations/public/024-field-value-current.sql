
CREATE TABLE "change_previous_field_value" (
    LIKE "change_field_value" INCLUDING ALL
);

ALTER TABLE "change_previous_field_value" RENAME CONSTRAINT "change_field_value_pkey" TO "change_previous_field_value_pkey";

ALTER TABLE "change_previous_field_value" ADD CONSTRAINT "fk_change_previous_field_value_change_id" FOREIGN KEY ("change_id") REFERENCES "change" ("id") ON DELETE CASCADE;

