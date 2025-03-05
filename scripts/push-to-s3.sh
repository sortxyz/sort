#!/bin/bash

# We allow to pass two github hashes, one for web and api

SORT_WEB_GITHUB_SHA=${1:-}
API_GITHUB_SHA=${2:-}

if ! aws sts get-caller-identity --no-cli-pager; then
    echo "Not logged into aws"
    exit 1
fi

echo "Logged into aws"

echo "Cleaning up..."

rm -rf deploy/
rm -rf deploy.tgz

mkdir -p deploy

echo "Copying license..."

cp ./ONPREM-LICENSE.txt ./deploy/LICENSE.txt

echo "Copying api..."

if [ -n "$API_GITHUB_SHA" ]; then
    echo "Checking out api $API_GITHUB_SHA"
    git checkout $API_GITHUB_SHA
fi

rsync -aq --progress .. ./deploy/api --exclude node_modules --exclude .git --exclude ".env*" --exclude .DS_Store --exclude .gitignore --exclude deploy

echo "Copying sortweb..."

if [ -n "$SORT_WEB_GITHUB_SHA" ]; then
    echo "Checking out sortweb $SORT_WEB_GITHUB_SHA"
    pushd .
    cd ../../sortweb
    git checkout $SORT_WEB_GITHUB_SHA
    popd
fi

rsync -aq --progress ../../sortweb/ ./deploy/sortweb --exclude node_modules --exclude .git --exclude ".env*" --exclude .DS_Store --exclude .gitignore --exclude deploy

echo "Creating tarball..."

tar -zcf deploy.tgz deploy

echo "Uploading to s3..."

GIT_VERSION=$(git rev-parse --short HEAD)

aws s3 cp deploy.tgz s3://sort-onprem-install/${GIT_VERSION}-deploy.tgz 

echo "Generating presigned URL..."

DEPLOY_PRESIGNED_URL=$(aws s3 presign s3://sort-onprem-install/${GIT_VERSION}-deploy.tgz --region us-west-2 --endpoint-url https://s3.us-west-2.amazonaws.com/ | sed "s|\&|\\\&|g")

cp setup-onprem-template.sh setup-onprem.sh

DEPLOY_PRESIGNED_URL="s|DEPLOY\_PRESIGNED\_URL|${DEPLOY_PRESIGNED_URL}|"

sed -i '' $DEPLOY_PRESIGNED_URL setup-onprem.sh

SETUP_PRESIGNED_URL=$(aws s3 presign s3://sort-onprem-install/${GIT_VERSION}-setup-onprem.sh --region us-west-2 --endpoint-url https://s3.us-west-2.amazonaws.com/)

aws s3 cp setup-onprem.sh s3://sort-onprem-install/${GIT_VERSION}-setup-onprem.sh 

echo "Run: wget -O setup-onprem.sh \"${SETUP_PRESIGNED_URL}\""

echo "Cleaning up..."

rm -rf deploy/
rm -f setup-onprem.sh
rm -f deploy.tgz

echo "Done"
