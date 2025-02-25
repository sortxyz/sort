#!/bin/bash

sudo yum update -y

# setup nvm, pnpm

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.nvm/nvm.sh
nvm install --lts
npm install -g pnpm

# setup docker
sudo yum install -y docker
sudo service docker start
sudo chkconfig docker on
sudo usermod -a -G docker ec2-user

# docker config
DOCKER_CONFIG=${DOCKER_CONFIG:-$HOME/.docker}
mkdir -p $DOCKER_CONFIG/cli-plugins
curl -SL https://github.com/docker/compose/releases/download/v2.32.4/docker-compose-linux-x86_64 -o $DOCKER_CONFIG/cli-plugins/docker-compose
chmod +x $DOCKER_CONFIG/cli-plugins/docker-compose

# pull and install
rm -rf deploy/
wget -O deploy.tgz "DEPLOY_PRESIGNED_URL"
gzip -d deploy.tgz
tar -xvf deploy.tar
cd deploy/api/scripts
sudo ./build-onprem.sh
