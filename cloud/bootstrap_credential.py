#!/usr/bin/env python3
"""Mint a long-lived OpenStack application credential and write clouds.yaml.

Cybera's Horizon does not expose the Application Credentials panel, so this
talks to Keystone v3 directly. Run it once; afterwards nothing needs the
account password.
"""

import getpass
import os
import sys
from pathlib import Path

import requests
import yaml

AUTH_URL = "https://keystone-yeg.cloud.cybera.ca:5000/v3"
CLOUD_NAME = "cybera"
CREDENTIAL_NAME = "say-less-automation"
CLOUDS_PATH = Path(__file__).resolve().parent / "secrets" / "clouds.yaml"


def password_token(username: str, project_id: str, password: str) -> tuple[str, str]:
    """Authenticate with the account password. Returns (token, user_id)."""
    payload = {
        "auth": {
            "identity": {
                "methods": ["password"],
                "password": {
                    "user": {
                        "name": username,
                        "domain": {"name": "Default"},
                        "password": password,
                    }
                },
            },
            "scope": {"project": {"id": project_id}},
        }
    }
    response = requests.post(f"{AUTH_URL}/auth/tokens", json=payload, timeout=30)
    response.raise_for_status()
    return response.headers["X-Subject-Token"], response.json()["token"]["user"]["id"]


def create_credential(token: str, user_id: str) -> dict:
    """Create an unrestricted, non-expiring application credential."""
    payload = {
        "application_credential": {
            "name": CREDENTIAL_NAME,
            "description": "Automation for the say-less project (create/resize/delete)",
            # Restricted: it keeps the full compute lifecycle (create/resize/
            # delete) but cannot mint further credentials or trusts.
            "unrestricted": False,
        }
    }
    response = requests.post(
        f"{AUTH_URL}/users/{user_id}/application_credentials",
        json=payload,
        headers={"X-Auth-Token": token},
        timeout=30,
    )
    if response.status_code == 409:
        raise RuntimeError(
            f"An application credential named {CREDENTIAL_NAME!r} already exists. "
            f"Delete it first: .venv/bin/openstack --os-cloud {CLOUD_NAME} "
            f"application credential delete {CREDENTIAL_NAME}"
        )
    response.raise_for_status()
    return response.json()["application_credential"]


def write_clouds(credential: dict) -> None:
    config = {
        "clouds": {
            CLOUD_NAME: {
                "auth_type": "v3applicationcredential",
                "auth": {
                    "auth_url": AUTH_URL,
                    "application_credential_id": credential["id"],
                    "application_credential_secret": credential["secret"],
                },
                "region_name": "Edmonton",
                "interface": "public",
                "identity_api_version": 3,
            }
        }
    }
    # Write with restrictive permissions before any secret reaches the disk.
    fd = os.open(CLOUDS_PATH, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as handle:
        yaml.safe_dump(config, handle, sort_keys=False)


def main() -> int:
    username = os.environ.get("OS_USERNAME") or input("OpenStack username: ").strip()
    project_id = os.environ.get("OS_PROJECT_ID") or input("Project ID: ").strip()
    if not username or not project_id:
        raise RuntimeError("Username and project ID are required (or set OS_USERNAME / OS_PROJECT_ID)")
    password = getpass.getpass(f"OpenStack password for {username} (not stored): ")
    if not password:
        raise RuntimeError("Password was empty")

    token, user_id = password_token(username, project_id, password)
    del password
    credential = create_credential(token, user_id)
    write_clouds(credential)

    print(f"Created application credential {credential['name']!r} ({credential['id']})")
    print(f"Wrote {CLOUDS_PATH} with mode 600")
    print("The secret is shown only once and is now only in that file.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except requests.HTTPError as error:
        print(
            f"Keystone rejected the request: HTTP {error.response.status_code} "
            f"{error.response.text[:200]}",
            file=sys.stderr,
        )
        raise SystemExit(1)
    except (KeyError, RuntimeError, requests.RequestException) as error:
        print(f"Could not create the application credential: {error}", file=sys.stderr)
        raise SystemExit(1)
