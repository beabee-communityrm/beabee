FROM node:12.16.3

RUN apt-get update && apt-get install -y jq

WORKDIR /
ADD package.json package-lock.json ./

RUN npm ci --only=production

WORKDIR /membership-system

#COPY . /membership-system

ENV NODE_PATH=/node_modules

ARG APP
ARG PORT

ENV APP=${APP}

EXPOSE ${PORT}
CMD ["/bin/bash", "-c", "node built/$APP 2>&1 | /node_modules/.bin/bunyan"]
