#!/bin/bash
export PGPASSWORD="${POSTGRES_PASSWORD:-dbadmin}";

declare migrations_path="/docker-entrypoint-initdb.d/migrations"

for file in $(find ${migrations_path} -mindepth 1 -maxdepth 3 -type f | sort -n); do
  echo "processing $file .."

  PGOPTIONS="--search_path=public"
  export PGOPTIONS
  psql -U "${POSTGRES_USER:-root}" -d "${POSTGRES_DB:-sort_xyz}" -f "${file}"
done
