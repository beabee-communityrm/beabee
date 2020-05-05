FROM node:12.16.3

WORKDIR /
ADD package.json package-lock.json ./

RUN npm install --only=production

WORKDIR /membership-system

#COPY . /membership-system

ENV NODE_PATH=/node_modules

EXPOSE 3001
CMD ["/bin/bash", "-c", "node app 2>&1 | /node_modules/.bin/bunyan"]
