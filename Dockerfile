# Stage 1: Dependencies
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: Builder
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build args for required env vars (build-time only)
ARG GOOGLE_CLIENT_ID=placeholder
ARG GOOGLE_CLIENT_SECRET=placeholder
ARG NEXTAUTH_SECRET=placeholder
ARG NEXTAUTH_URL=http://localhost:3000

ENV GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
ENV GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV NEXTAUTH_URL=$NEXTAUTH_URL

RUN npm run build

# Stage 3: Runner
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Private data root (entries, uploads, profiles — all PII lives here, mount a volume)
RUN mkdir -p .data && \
    chown -R nextjs:nodejs .data

# Copy standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Operational data needed at runtime (roster + admin list ONLY — never
# profiles/uploads; those are runtime-generated under .data/)
COPY --from=builder /app/data/faculty.json ./data/faculty.json
COPY --from=builder /app/data/admins.json ./data/admins.json

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
