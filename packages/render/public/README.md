# public/

Place the sample screen recording here as `demo01.mp4` (~10–40s, visible mouse
activity). Then update `samples/demo01/editplan.json` `base` with its real
width / height / fps / durationSec (via `ffprobe public/demo01.mp4`).

This directory is served by Remotion via `staticFile()`. Media files are not
committed — see .gitignore.
