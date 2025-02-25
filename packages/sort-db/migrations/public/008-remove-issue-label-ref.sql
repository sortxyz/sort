DROP INDEX "idx_metadata_database_label_metadata_database";
DROP INDEX "idx_metadata_database_label_label_id";
DROP INDEX "idx_label_is_default";

DROP TABLE public."metadata_database_label";

ALTER TABLE public."label" DROP COLUMN "is_default";

ALTER TABLE public."label" ADD COLUMN "metadata_database_connection_id" UUID NOT NULL;
ALTER TABLE public."label" ADD COLUMN "metadata_database_raw_name" VARCHAR(200) NOT NULL;

ALTER TABLE public."label" ADD CONSTRAINT "fk_label_md_database_connection_id_metadb_db_raw_name" FOREIGN KEY ("metadata_database_connection_id", "metadata_database_raw_name") REFERENCES public."metadata_database" (connection_id, raw_name) ON DELETE CASCADE;

ALTER TABLE public."label" DROP CONSTRAINT "uc_label_name_description_color";
ALTER TABLE public."label" ADD CONSTRAINT "uc_label_name_description_color_connection_id_raw_name" UNIQUE ("name", "description", "color", "metadata_database_connection_id", "metadata_database_raw_name");

CREATE TABLE public."default_label" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(128) NOT NULL,
  "description" TEXT,
  "color" CHAR(7) NOT NULL,
  CONSTRAINT "uc_label_name_description_color" UNIQUE ("name", "description", "color"),
  CONSTRAINT "chk_color_hex" CHECK ("color" ~ '^#([A-Fa-f0-9]{6})$')
);

-- Insert default labels
INSERT INTO public."default_label" (name, description, color) values
('Question', 'Question about the database, a query, or specific data', '#7057ff'),
('Bug', 'Something isn''t working', '#d73a4a'),
('Query Help', 'Help with creating a SQL query', '#008672'),
('Won''t Fix', 'This won''t be worked on', '#ffffff'),
('Security', 'Security issue', '#B60205'),
('Invalid', 'This doesn''t seem right', '#e4e669'),
('Help Wanted', 'Extra attention is needed', '#a2eeef'),
('Duplicate', 'This issue or change request already exists', '#cfd3d7'),
('Documentation', 'Improvements or additions to database documentation', '#0075ca'),
('Data:fix', 'Incorrect data was found', '#0366d6'),
('Data:addition', 'Please add this data', '#44DDA5');
