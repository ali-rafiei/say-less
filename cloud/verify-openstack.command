#!/bin/zsh

cd /Users/e401621/Desktop/Code/zpersonal/say-less || exit 1
./.venv/bin/python ./cloud/verify_openstack_access.py

echo
read "REPLY?Press Return to close this window."
