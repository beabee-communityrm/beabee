#!/bin/bash -x
cd "$( dirname "$0" )"
PGAPASSWORD=$(jq -r .db.password ../../config/config.json) psql \
    -U $(jq -r .db.username ../../config/config.json) \
    -h $(jq -r .db.host ../../config/config.json) \
    -d $(jq -r .db.database ../../config/config.json)
