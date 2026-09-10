FROM nginx:1.27-alpine

RUN mkdir -p /var/www/certbot

COPY nginx/proxy.conf /etc/nginx/templates/default.conf.template

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q --tries=1 --spider http://127.0.0.1/health/live || exit 1

CMD ["nginx", "-g", "daemon off;"]
