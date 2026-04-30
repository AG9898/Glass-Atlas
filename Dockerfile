FROM oven/bun:1 AS builder
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends git python3 make g++ npm \
  && rm -rf /var/lib/apt/lists/*
ARG AUTH_SECRET
ARG AUTH_GITHUB_ID
ARG AUTH_GITHUB_SECRET
ENV AUTH_SECRET=${AUTH_SECRET}
ENV AUTH_GITHUB_ID=${AUTH_GITHUB_ID}
ENV AUTH_GITHUB_SECRET=${AUTH_GITHUB_SECRET}
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN bun run build

FROM oven/bun:1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["bun", "build/index.js"]
