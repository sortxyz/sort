import { builtins } from 'pg-types'

import { postgresErrorCodes } from './__generated/postgres.errors.constant'

import type {
  DataProviderColumnMapping,
  ResponseColumnTypes
} from '../schemas/response-column.schema'

export const pg7ErrorConditionCodes = postgresErrorCodes

// ref: https://github.com/snowflakedb/snowflake-jdbc/blob/master/src/main/java/net/snowflake/client/jdbc/ErrorCode.java#L14
export const snowflakeErrorConditionCodes = {
  DATETIME_PARSE_INVALID: '100040',
  STRING_NUMERIC_COMPARISON_ERROR: '100038',
  SQL_COMPILATION_ERROR: '000904',
  SHARED_VIEW_EXPANSION_ERROR: '090804',
  DOMAIN_DOES_NOT_EXIST_OR_NOT_AUTHORIZED: '002003',
  DOMAIN_DOES_NOT_EXIST_ERROR: '002003' // https://github.com/snowflakedb/snowflake-ml-python/blob/2932445f3e0fbf42000d51ec9c9256032570ed76/snowflake/ml/_internal/exceptions/fileset_errors.py#L3
} satisfies Record<string, string>

export const PG7_DATABASE_TABLE = 'pg_database'
export const PG7_EXCLUDED_SCHEMAS = [
  'pg_catalog',
  'information_schema',
  'pg_toast'
]

export const SNOWFLAKE_EXCLUDED_DATABASES = ['SNOWFLAKE']
export const SNOWFLAKE_EXCLUDED_SCHEMAS = ['INFORMATION_SCHEMA']

export type DataProviderReverseColumnMapping = Record<
  string,
  string | undefined
>

/**
 * Maps column names to our own internal type ResponseColumnTypes
 */
export const PostgresColumnMappings = {
  uuid: ['uuid'],
  binary: ['bytea'],
  string: ['varchar', 'text', 'char', 'citext', 'bpchar'],
  numeric: ['int2', 'int4', 'int8', 'float4', 'float8', 'numeric', 'money'],
  boolean: ['bool'],
  date: ['date', 'timestamp', 'timestamptz'],
  json: ['json', 'jsonb']
} satisfies DataProviderColumnMapping

export const DataTypeIdToColumnTypeMappings = {
  uuid: [builtins.UUID],
  string: [builtins.VARCHAR, builtins.TEXT, builtins.CHAR, builtins.BPCHAR],
  binary: [builtins.BYTEA],
  numeric: [
    builtins.INT2,
    builtins.INT4,
    builtins.INT8,
    builtins.FLOAT4,
    builtins.FLOAT8,
    builtins.NUMERIC,
    builtins.MONEY
  ],
  boolean: [builtins.BOOL],
  date: [builtins.DATE, builtins.TIMESTAMP, builtins.TIMESTAMPTZ],
  json: [builtins.JSON, builtins.JSONB]
} satisfies { [key in ResponseColumnTypes]: number[] }

export const PostgresReverseColumnMappings: DataProviderReverseColumnMapping =
  {}
for (const [key, values] of Object.entries(PostgresColumnMappings)) {
  for (const value of values) {
    PostgresReverseColumnMappings[value] = key
  }
}

// ref: https://docs.snowflake.com/en/sql-reference/intro-summary-data-types
export const SnowflakeColumnMappings = {
  // there is no UUID type in Snowflake, we make up a garbage type that'll never be found
  // to keep the type system happy
  uuid: ['uuiddoesntexist'],
  string: ['char', 'character', 'varchar', 'text', 'string'],
  numeric: [
    'number',
    'fixed',
    'decimal',
    'int',
    'integer',
    'smallint',
    'tinyint',
    'byteint',
    'float',
    'float4',
    'float8',
    'double',
    'double precision',
    'real'
  ],
  boolean: ['boolean'],
  date: [
    'date',
    'datetime',
    'time',
    'timestamp',
    'timestamp_ltz',
    'timestamp_ntz',
    'timestamp_tz'
  ],
  json: ['variant', 'object', 'array'],
  binary: ['binary']
} satisfies DataProviderColumnMapping

export const SnowflakeReverseColumnMappings: DataProviderReverseColumnMapping =
  {}
for (const [key, values] of Object.entries(SnowflakeColumnMappings)) {
  for (const value of values) {
    SnowflakeReverseColumnMappings[value] = key
  }
}

export const MAX_QUERY_LIMIT = 100
export const DEFAULT_QUERY_LIMIT = 100
