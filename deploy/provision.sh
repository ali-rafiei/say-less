#!/bin/bash
# Create the Cybera instance for Say Less (one-time). Idempotent: exits if it exists.
#   deploy/provision.sh [name] [flavor]
#
# m1.micro (1 vCPU, 1 GB RAM, 5 GB disk) is enough: the game holds every room in
# memory and a full 8-player room is a few kilobytes. cloud-init adds swap so the
# image still builds in place.
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="${1:-say-less-prod}"
FLAVOR="${2:-m1.micro}"
OS=./cloud/os

if $OS server show "$NAME" >/dev/null 2>&1; then
  echo "Instance $NAME already exists:"
  $OS server show "$NAME" -f value -c status -c addresses -c properties
  exit 0
fi

echo "Creating $NAME ($FLAVOR, Ubuntu 24.04, keypair say-less, security group default)..."
$OS server create "$NAME" \
  --image "Ubuntu 24.04" \
  --flavor "$FLAVOR" \
  --key-name say-less \
  --network default \
  --security-group default \
  --user-data deploy/cloud-init.yaml \
  --wait \
  -f value -c id -c status

echo
echo "Addresses / DNS:"
$OS server show "$NAME" -f value -c addresses -c properties
echo
echo "First boot installs Docker and starts the stack (3-6 minutes). Follow with:"
echo "  deploy/deploy.sh $NAME --logs"
