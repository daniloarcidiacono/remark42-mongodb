#!/bin/bash
if [ "$#" -ne 2 ]; then
  echo "Usage"
  echo "./record.sh [output] [title]"
else
  echo "asciinema rec -i 1 -t \"$2\" --overwrite $1"
  asciinema rec -i 1 -t "$2" --overwrite $1
fi
