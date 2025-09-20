FROM node:20-alpine 

ADD . /app

WORKDIR /app

RUN ls /app -al

RUN npm i -g @nestjs/cli

RUN npm i -g prisma
RUN yarn --force

COPY apps/core/package.json dist/apps/core/
COPY apps/core/tsconfig.app.json dist/apps/core/

RUN prisma generate 
RUN yarn build:core

CMD yarn start:core:prod