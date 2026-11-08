# node 22.23.4: rejects chains with the compromised eMudhra intermediates (same pin as argus-studio).
FROM node:22.23.4-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# postinstall copies laz-perf.wasm into public/
COPY scripts ./scripts
RUN --mount=type=cache,target=/root/.npm npm ci

FROM base AS builder
WORKDIR /app
# No build args: the API base is read from the container's environment per request
# (src/lib/runtimeConfig.ts), so one image deploys to any origin.
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY --from=deps /app/public/laz-perf.wasm ./public/laz-perf.wasm
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
