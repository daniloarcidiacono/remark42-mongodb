#!/bin/bash
if [ "$#" -ne 1 ]; then
  echo "Usage"
	echo "./convert.sh [filename]"
else
  # https://stackoverflow.com/questions/965053/extract-filename-and-extension-in-bash
  filename=$1

  # https://github.com/marionebl/svg-term-cli/issues/28
  svg-term --command="asciinema play $1 && sleep 5 && echo" --out "/mnt/c/workspace_fe/remark42-mongodb/docs/asciinema/${filename%.*}.svg" --window
	cp $1 "/mnt/c/workspace_fe/remark42-mongodb/docs/asciinema"
fi
