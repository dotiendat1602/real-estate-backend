FROM node:20-alpine 

ADD . /app

WORKDIR /app

RUN ls /app -al

RUN npm i -g @nestjs/cli

RUN yarn --force

COPY apps/scheduler/package.json dist/apps/scheduler/
COPY apps/scheduler/tsconfig.app.json dist/apps/scheduler/

RUN yarn build:scheduler 

CMD yarn start:scheduler:prod