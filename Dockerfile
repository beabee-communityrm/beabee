FROM node:12.16.3-alpine as builder

RUN apk add --no-cache python make g++ git

WORKDIR /opt/membership-system
COPY package.json package-lock.json /opt/membership-system/

RUN npm ci --only=production

FROM node:12.16.3-alpine as app

WORKDIR /opt/membership-system

COPY --chown=node:node --from=builder /opt/membership-system /opt/membership-system
COPY --chown=node:node ./built /opt/membership-system/built

USER node

RUN touch /opt/membership-system/built/revision.txt
