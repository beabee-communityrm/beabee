#!/bin/bash

cd "$( dirname "$0" )"

export TYPEORM_CONNECTION=$(jq -r .db.type ../../config/config.json)
export TYPEORM_USERNAME=$(jq -r .db.username ../../config/config.json)
export TYPEORM_PASSWORD=$(jq -r .db.password ../../config/config.json)
export TYPEORM_HOST=$(jq -r .db.host ../../config/config.json)
export TYPEORM_DATABASE=$(jq -r .db.database ../../config/config.json)

npx typeorm schema:sync
