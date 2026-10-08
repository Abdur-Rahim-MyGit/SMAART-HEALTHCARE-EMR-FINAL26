# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S smaart && adduser -S smaart -G smaart
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
USER smaart
EXPOSE 5001
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:${PORT:-5001}/health/live || exit 1
# API by default; the worker image uses the same build with a different command.
CMD ["node", "src/server.js"]
