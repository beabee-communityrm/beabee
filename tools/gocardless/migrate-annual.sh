#!/bin/bash
cd "$(dirname "$0")"

date=$(date -Idate)

echo "Running on $date"

node ./migrate-annual.js $date subscriptions-final.csv
