# Multi-stage Dockerfile for React Client
# Optimized for production with minimal final image size

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

LABEL stage=builder

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Set build-time environment variables
ARG VITE_API_URL=http://localhost:5000
ARG VITE_API_VERSION=v1
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_API_VERSION=${VITE_API_VERSION}

# Copy source code
COPY . .

# Build React application
RUN npm run build

# Stage 2: Production Serve
FROM nginx:1.27-alpine

LABEL description="React frontend served via Nginx"
LABEL maintainer="E-Commerce Team"

# Copy Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Set proper permissions for nginx user (already exists in nginx image)
RUN chown -R nginx:nginx /usr/share/nginx/html /etc/nginx /var/cache/nginx && \
    chmod -R 755 /usr/share/nginx/html

USER nginx

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ > /dev/null || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
