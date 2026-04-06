FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY scripts ./scripts
COPY src ./src
COPY tsconfig.json ./

RUN npm run db:generate
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080

CMD ["sh", "-lc", "npm run db:push && node dist/server.js"]
