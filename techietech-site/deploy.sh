#!/bin/sh
# publishes public/techietech at https://techytech.web.app (the same files also stay at /techietech/ on the main site)
cd "$(dirname "$0")" && rm -rf dist && cp -r ../public/techietech dist && firebase deploy --only hosting --project boostmind-b052c
