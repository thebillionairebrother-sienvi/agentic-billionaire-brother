# ==============================================================================
# Sienvi Edge VPS — Billionaire Brother Swarm Worker Container
# Standards: governance/VPS_DOCKER_CONTAINER_STANDARD.md
# Non-root UID 1000, memory-conscious Alpine base
# ==============================================================================

FROM node:20-alpine AS base

# Install dumb-init for clean PID 1 signal forwarding
RUN apk add --no-cache dumb-init curl

# Create non-root app user matching host UID 1000:1002 if not present
RUN addgroup -g 1002 appgroup 2>/dev/null || true && \
    adduser -u 1000 -G appgroup -D -s /bin/sh appuser 2>/dev/null || true

WORKDIR /app

# Prepare sandboxed directories
RUN mkdir -p /app/code /app/drafts /app/logs && \
    chown -R 1000:1002 /app

# Copy dependency definition
COPY --chown=1000:1002 code/package.json /app/package.json

# Install production dependencies inside container image
USER 1000:1002
RUN npm install --omit=dev --no-audit --no-fund

# Entrypoint via dumb-init
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Worker entrypoint (code is mounted read-only at runtime)
CMD ["node", "/app/code/worker.js"]
