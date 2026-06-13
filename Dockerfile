# syntax=docker/dockerfile:1

# ---------- dépendances + build ----------
FROM node:24-alpine AS build
WORKDIR /app
# outils nécessaires à la compilation de better-sqlite3 si pas de prebuild musl
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma.config.ts tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs ./
COPY prisma ./prisma
COPY public ./public
COPY messages ./messages
COPY src ./src
RUN npx prisma generate && npm run build

# ---------- dépendances de production ----------
FROM node:24-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm rebuild better-sqlite3

# ---------- image finale ----------
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache su-exec

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/src/generated ./src/generated
COPY package.json next.config.ts prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
COPY public ./public
COPY messages ./messages
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN mkdir -p /app/data && chown -R node:node /app /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

ENV DATA_DIR=/app/data
ENV DATABASE_URL=file:/app/data/ppush.db

# Build provenance (injected by CI from the git tag/sha), surfaced in the UI.
ARG BUILD_VERSION=dev
ARG BUILD_SHA=
ENV APP_VERSION=$BUILD_VERSION
ENV APP_SHA=$BUILD_SHA

EXPOSE 3000

# l'entrypoint chown le volume puis droppe les privilèges vers l'utilisateur node
ENTRYPOINT ["/docker-entrypoint.sh"]
