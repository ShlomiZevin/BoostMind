#!/bin/sh
# Web copies of finished editor exports for /wiki/: 720p H.264, faststart, plus a poster frame.
# usage: sh scripts/wiki/encode.sh <episode-id>...   (skips ones already encoded)
cd "$(dirname "$0")/../.."
mkdir -p public/wiki/v
for id in "$@"; do
  src="zoomcut/episodes/$id/out/$id.mp4"
  [ -f "$src" ] || { echo "skip $id (no export)"; continue; }
  dst="public/wiki/v/$id.mp4"
  if [ ! -f "$dst" ] || [ "$src" -nt "$dst" ]; then
    ffmpeg -v error -y -i "$src" -vf "scale=720:-2" -c:v libx264 -preset veryfast -crf 27 -c:a aac -b:a 96k -movflags +faststart "$dst" && echo "video $id"
  fi
  ffmpeg -v error -y -ss 1.5 -i "$dst" -frames:v 1 -vf "scale=480:-2" -q:v 4 "public/wiki/v/$id.jpg" && echo "poster $id"
done
