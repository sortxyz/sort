SET search_path TO public;

-- connection indices
CREATE INDEX metadata_database_connection_id ON public."metadata_database" USING btree ("connection_id");

CREATE INDEX metadata_table_connection_id ON public."metadata_table" USING btree ("connection_id");

CREATE INDEX query_connection_id ON public."query" USING btree ("connection_id");
