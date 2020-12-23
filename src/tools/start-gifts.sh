#!/bin/bash
cd "$(dirname "$0")"

date=$(date -Idate)

echo "Starting gifts on $date"

node ./start-gifts.js $date
