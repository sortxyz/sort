
-- add default field to columns snapshot
ALTER TABLE public."snapshot_column" ADD COLUMN "has_default" BOOLEAN NULL;