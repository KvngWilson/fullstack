# Multi-stage Dockerfile for React Client

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

LABEL stage=builder

COPY package*.json ./

RUN npm ci

ARG VITE_API_URL=http://localhost:5000
ARG VITE_API_VERSION=v1
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_API_VERSION=${VITE_API_VERSION}

COPY . .

RUN npm run build

# Stage 2: Production Serve
FROM nginx:1.27-alpine

LABEL description="React frontend served via Nginx"
LABEL maintainer="E-Commerce Team"

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

RUN chown -R nginx:nginx /usr/share/nginx/html /etc/nginx /var/cache/nginx && \
    chmod -R 755 /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- http://127.0.0.1/ > /dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
