FROM node:20.8-alpine as builder

RUN apk add --no-cache make g++ git gcc libgcc libstdc++ linux-headers python3
RUN npm install -g node-gyp 

WORKDIR /opt/membership-system

COPY package.json package-lock.json /opt/membership-system/
RUN npm ci

COPY gulpfile.js tsconfig.json tsconfig.build.json /opt/membership-system/
COPY ./src /opt/membership-system/src/
RUN NODE_ENV=production npm run build

FROM nginx:1.24-alpine as router

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --chown=nginx:nginx --from=builder /opt/membership-system/built/static /opt/membership-system/built/static

FROM node:20.8-alpine as app

ARG REVISION=DEV

ENV NODE_ENV=production

WORKDIR /opt/membership-system

COPY package.json package-lock.json /opt/membership-system/
COPY --chown=node:node --from=builder /opt/membership-system/node_modules /opt/membership-system/node_modules
RUN npm prune

COPY --chown=node:node --from=builder /opt/membership-system/built /opt/membership-system/built

COPY crontab /etc/crontabs/root

RUN echo -n ${REVISION} > /opt/membership-system/built/revision.txt

ENV NODE_ENV=production
ENV NODE_OPTIONS=--enable-source-maps
ENV TYPEORM_MIGRATIONS=built/migrations/*.js
ENV TYPEORM_ENTITIES=built/models/*.js

USER node
CMD [ "node", "built/app" ]
