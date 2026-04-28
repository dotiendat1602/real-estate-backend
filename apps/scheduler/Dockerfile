FROM node:20-bookworm-slim AS deps

WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json yarn.lock ./
COPY apps/core/package.json apps/core/package.json
COPY apps/scheduler/package.json apps/scheduler/package.json

RUN yarn install --frozen-lockfile

FROM deps AS builder

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY prisma ./prisma
COPY apps ./apps
COPY libs ./libs
COPY types ./types

RUN yarn prisma:generate
RUN yarn build:scheduler

FROM mcr.microsoft.com/playwright:v1.58.2-noble AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json yarn.lock ./

EXPOSE 3002

CMD ["node", "dist/apps/scheduler/src/main.js"]
