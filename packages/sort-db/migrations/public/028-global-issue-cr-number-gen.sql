/** Finds the max number across both issue and change request tables and increments by 1 */
CREATE OR REPLACE FUNCTION next_change_request_or_issue_number(connection_id uuid, raw_name varchar(200)) RETURNS INTEGER AS $$
DECLARE next_number INT;
BEGIN
  SELECT MAX(item_number) + 1 INTO next_number
    FROM (
      SELECT coalesce(MAX(issue_number), 0) AS item_number
      FROM "issue"
      WHERE "metadata_database_connection_id" = connection_id
        AND "metadata_database_raw_name" = raw_name
      UNION ALL
      SELECT coalesce(MAX(change_request_number), 0) AS item_number
      FROM "change_request"
      WHERE "metadata_database_connection_id" = connection_id
        AND "metadata_database_raw_name" = raw_name
    ) AS combined;
   RETURN next_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION change_request_number_sequence() RETURNS TRIGGER AS $$
BEGIN
  NEW.change_request_number := next_change_request_or_issue_number(NEW."metadata_database_connection_id", NEW."metadata_database_raw_name");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a sequence generator for issue_number per metadata_database
CREATE OR REPLACE FUNCTION issue_number_sequence() RETURNS TRIGGER AS $$
BEGIN
  NEW.issue_number := next_change_request_or_issue_number(NEW."metadata_database_connection_id", NEW."metadata_database_raw_name");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
