# Multi-stage Dockerfile for Node.js API Server
# Production-optimized build with minimal final image size

# Stage 1: Dependencies
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 2: Development Dependencies (for migrations and build tools)
FROM node:20-alpine AS dev-deps

WORKDIR /app

COPY package*.json ./

RUN npm ci && \
    npm cache clean --force

# Stage 3: Build/Runtime
FROM node:20-alpine AS runtime

WORKDIR /app

# Set environment
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ENV PORT=5000
ENV PATH=/app/node_modules/.bin:$PATH

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production dependencies from deps stage
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy development dependencies for migrations
COPY --from=dev-deps --chown=nodejs:nodejs /app/node_modules ./node_modules_dev

# Copy application source
COPY --chown=nodejs:nodejs . .

# Create necessary directories
RUN mkdir -p logs uploads && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD wget -q --tries=1 --spider http://127.0.0.1:5000/api/v1/health || exit 1

# Start application
CMD ["node", "src/index.js"]