-- reduce contention during snapshots and org deletion
CREATE INDEX organization_invite_organization_id ON public."organization_invite" USING btree ("organization_id");
CREATE INDEX metadata_database_slug ON public."metadata_database" USING btree ("slug");
CREATE INDEX snapshot_column_table_id ON public."snapshot_column" USING btree ("table_id");
CREATE INDEX change_connection_id ON public."change" USING btree ("connection_id");
CREATE INDEX change_metadata_table_name ON public."change" USING btree ("metadata_table_name", "metadata_schema_name", "metadata_database_name", connection_id);
