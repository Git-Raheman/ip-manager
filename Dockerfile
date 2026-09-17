# ==========================================
# Stage 1: Build Stage (Node.js 20 Alpine)
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies
RUN npm install

# Copy application source code
COPY . .

# Build Vite client and server bundle
RUN npm run build

# ==========================================
# Stage 2: Production Runtime Stage
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

# Production environment variables
ENV NODE_ENV=production
ENV APP_PORT=80
ENV DATA_DIR=/app/data

# Install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy compiled distribution from builder
COPY --from=builder /app/dist ./dist

# Create persistent storage folder
RUN mkdir -p /app/data

VOLUME ["/app/data"]

EXPOSE 80

# Health check
HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/api/health || exit 1

# Start the full-stack server
CMD ["node", "dist/server.cjs"]
