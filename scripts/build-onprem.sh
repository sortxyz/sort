#!/bin/bash

# Test if sortweb directory exists
if [ ! -d "../../sortweb" ]; then
  echo "sortweb directory does not exist"
  exit 1
fi

# Builds images for docker-compose

EXTRA_ARGS=${1:-}

docker build --target api ../. --tag sort-api ${EXTRA_ARGS}
docker build --target worker ../. --tag sort-worker ${EXTRA_ARGS}
docker build . --tag sort-postgres ${EXTRA_ARGS}
docker build ../../sortweb --tag sort-web ${EXTRA_ARGS}

# Generate self-signed cert for HTTPS support
./nginx-proxy/generate-self-signed-cert.sh
