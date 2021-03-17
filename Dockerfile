FROM node:12.16.3-alpine as builder

RUN apk add --no-cache python make g++ git

COPY . /opt/membership-system

WORKDIR /opt/membership-system
RUN cp ./src/config/example-config.json ./src/config/config.json
RUN npm ci
RUN NODE_ENV=production npm run build
RUN npm ci --only=production

FROM node:12.16.3-alpine as app

ARG REVISION=DEV

COPY --chown=node:node --from=builder /opt/membership-system/package.json /opt/membership-system/
COPY --chown=node:node --from=builder /opt/membership-system/node_modules /opt/membership-system/node_modules
COPY --chown=node:node --from=builder /opt/membership-system/built /opt/membership-system/built

COPY router/ /opt/membership-system/router/
COPY crontab /etc/crontabs/root

RUN echo -n ${REVISION} > /opt/membership-system/built/revision.txt

ENV NODE_ENV=production
ENV NODE_OPTIONS=--enable-source-maps

WORKDIR /opt/membership-system
USER node
CMD [ "node", "built/app" ]
