
CREATE TYPE test_enum_type_varchar AS ENUM ('test 1', 'test 2', 'test 3');

CREATE TABLE IF NOT EXISTS test."change_request_test_unsupported_types" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "test_bytea" BYTEA NULL,
  "test_inet" INET NULL,
  "test_enum" test_enum_type_varchar NULL,
  "test_point" POINT NULL,
  "test_lseg" LSEG NULL,
  "test_box" BOX NULL,
  "test_path" PATH NULL,
  "test_polygon" POLYGON NULL,
  "test_circle" CIRCLE NULL,
  "test_money" MONEY NULL,
  "test_tsvector" TSVECTOR NULL,
  "test_tsquery" TSQUERY NULL,
  "test_xml" XML NULL,
  "test_bit" BIT NULL,
  "test_varbit" VARBIT NULL,
  "test_bit_varying" BIT VARYING NULL,
  "test_text_array" TEXT[] NULL,
  "test_integer_array" INTEGER[] NULL,
  "test_integer_array_array" INTEGER[][] NULL,
  "test_numeric_array" NUMERIC[] NULL,
  "test_boolean_array" BOOLEAN[] NULL
);