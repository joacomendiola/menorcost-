# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
ENV NODE_ENV=production
WORKDIR /app

FROM base AS deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# Build requires devDependencies (prisma CLI, Nest CLI, TypeScript). NODE_ENV is production in base.
RUN npm ci --include=dev

FROM deps AS build
COPY tsconfig*.json nest-cli.json ./
COPY prisma ./prisma
COPY prisma7.config.ts ./
COPY src ./src
RUN npx prisma generate
RUN npm run build

FROM base AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    PORT=3000 \
    UPLOAD_DIR=/app/uploads \
    TZ=America/Argentina/Ushuaia

WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma7.config.ts ./
COPY --from=build /app/src/generated ./src/generated
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh \
  && chmod +x /usr/local/bin/docker-entrypoint.sh \
  && mkdir -p /app/uploads

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
