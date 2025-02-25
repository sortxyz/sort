# Steps to run in AMI Docker Host

* Create AMI instance in EC2 (Follow setup below)
* Locally: Login using the AWS CLI
* Locally: Run `./push-to-s3.sh`
* SSH to your EC2 host: `ssh ec2-user@<public ip>`
* EC2 host: Run command(s) that came out of `./push-to-s3`
* EC2 host: Run `chmod +x setup-onprem.sh`
* EC2 host: Run `./setup-onprem.sh`
* Re-login to your EC2 host
* EC2 host: Go to `~/deploy/api`
* EC2 host: Run `docker compose up -d`
* Web browser: Go to `https://<public ip>`
    - You may need to adjust the security group of the EC2 instance before you can reach it. Go to the EC2 instance dashboard -> security -> security groups (click on your group) -> Edit inbound rules -> Add rule (for port 443)

## Steps to run locally

Run: `./build-onprem.sh`
Then run `docker compose up -d`

# Setup

## Run ./push-to-s3.sh

You need to be logged into aws console. This will push to our semi-private s3 bucket.

## Setup EC2

* Launch Instance
* Give it a name
* AMI: Amazon Linux Image 2023
* Instance Type: t2.large or above
    - For building our Docker images and running the Docker host
* Key pair: Add your key pair. Make sure to add it local
* Network settings: Allow HTTPS Traffic from the internet setting checked

