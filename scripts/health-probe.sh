#!/bin/bash

export PGUSER="$POSTGRES_USER"
export PGDATABASE="$POSTGRES_DB"
export PGPASSWORD="$POSTGRES_PASSWORD"

if [[ $(psql --csv -h localhost -c 'select 1 FROM public.loading_finished;') == *1* ]];
then
    echo "ok";
    exit 0;
else
    exit 1;
fi
