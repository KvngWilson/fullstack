# Multi-stage Dockerfile for Node.js API Server

# Stage 1: Dependencies
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files
COPY package*.json ./

RUN npm ci && \
    npm cache clean --force

# Stage 2: Build/Runtime
FROM node:20-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache wget

# Set environment
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ENV PORT=5000
ENV PATH=/app/node_modules/.bin:$PATH

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy dependencies from deps stage
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application source
COPY --chown=nodejs:nodejs . .

# Create necessary directories
RUN mkdir -p logs uploads && \
    chown nodejs:nodejs logs uploads

# Switch to non-root user
USER nodejs

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD wget -q --tries=1 --spider http://127.0.0.1:5000/health/live || exit 1

CMD ["sh", "-c", "npm run start"]