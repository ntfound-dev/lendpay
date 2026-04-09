FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
RUN npm ci

COPY backend/prisma ./prisma
COPY backend/scripts ./scripts
COPY backend/src ./src
COPY backend/tsconfig.json ./

RUN npm run db:generate
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080

CMD ["sh", "-lc", "npm run db:push && node dist/server.js"]
