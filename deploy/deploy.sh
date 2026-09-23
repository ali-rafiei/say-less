#!/bin/bash
# Re-deploy the current GitHub main to the instance over SSH (IPv6).
#   deploy/deploy.sh [name] [--logs]
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="${1:-say-less-prod}"
OS=./cloud/os
KEY=cloud/secrets/say-less.pem

IPV6="$($OS server show "$NAME" -f json | python3 -c 'import json,sys; a=json.load(sys.stdin)["addresses"]; print(next(x for v in a.values() for x in v if ":" in x))')"
DNS_NAME="$($OS server show "$NAME" -f json | python3 -c 'import json,sys; print(json.load(sys.stdin).get("properties",{}).get("dns",""))')"
SSH=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 "ubuntu@$IPV6")
echo "Instance $NAME  ipv6=$IPV6  dns=${DNS_NAME:-<none>}"

if [ "${2:-}" = "--logs" ]; then
  "${SSH[@]}" 'sudo tail -n 60 /var/log/say-less-bootstrap.log; cd /opt/say-less/deploy && sudo docker compose ps && sudo docker compose logs --tail 40'
  exit 0
fi

"${SSH[@]}" bash -s "$DNS_NAME" <<'REMOTE'
set -euo pipefail
DNS_NAME="$1"
cd /opt/say-less
git fetch --depth 1 origin main
git reset --hard origin/main
if [ -n "$DNS_NAME" ]; then echo "SITE_ADDRESS=$DNS_NAME" | sudo tee deploy/.env >/dev/null; fi
cd deploy
sudo docker compose up -d --build --remove-orphans
# The Caddyfile is a bind-mounted file; git replaces the inode, so recreate Caddy to pick it up.
sudo docker compose up -d --force-recreate caddy
sudo docker image prune -f >/dev/null
# m1.micro has a 5 GB root; the build cache is the biggest thing on it.
sudo docker builder prune -af >/dev/null
sudo docker compose ps
REMOTE
echo "Deployed. https://${DNS_NAME:-$IPV6}/"
