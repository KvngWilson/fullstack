FROM nginx:1.27-alpine

COPY nginx/proxy.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q --tries=1 --spider http://127.0.0.1/health/live || exit 1

CMD ["nginx", "-g", "daemon off;"]
