#!/usr/bin/env python3
"""Confirm the application credential in clouds.yaml can reach Cybera.

Read-only: lists instances and the flavors available for resizing.
"""

import sys
from pathlib import Path

import openstack
from keystoneauth1.exceptions import ClientException
from openstack.config.loader import OpenStackConfig

CLOUD_NAME = "cybera"
CLOUDS_PATH = Path(__file__).resolve().parent / "secrets" / "clouds.yaml"


def main() -> int:
    if not CLOUDS_PATH.exists():
        raise RuntimeError(f"{CLOUDS_PATH} is missing. Run bootstrap_credential.py first.")

    # The SDK only auto-discovers clouds.yaml in standard locations, so point
    # the loader at ours explicitly.
    region = OpenStackConfig(config_files=[str(CLOUDS_PATH)]).get_one(cloud=CLOUD_NAME)
    conn = openstack.connection.from_config(config=region)
    servers = list(conn.compute.servers())
    flavors = list(conn.compute.flavors())

    print(f"Authenticated to project: {conn.current_project_id}")
    print(f"Instances visible: {len(servers)}")
    for server in servers:
        print(f"- {server.name} | {server.status} | {server.id}")
    print(f"Flavors available for resize: {len(flavors)}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, ClientException, openstack.exceptions.SDKException) as error:
        print(f"OpenStack verification failed: {error}", file=sys.stderr)
        raise SystemExit(1)
