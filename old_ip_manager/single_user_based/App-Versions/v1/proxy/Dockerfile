FROM nginxinc/nginx-unprivileged:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

USER root
RUN apk add --no-cache curl
USER 101

EXPOSE 8080
