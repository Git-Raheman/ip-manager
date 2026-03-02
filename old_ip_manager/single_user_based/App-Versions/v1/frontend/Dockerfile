# Build Stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN npm run build

# Production Stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Run as non-root (optional, but good practice - requires more config for standard nginx image, 
# but for simplicity we'll stick to standard or use unprivileged if strictly required. 
# The prompt asks for non-root. Standard nginx runs as root by default to bind port 80.
# To make it non-root, we can use nginxinc/nginx-unprivileged or configure it.
# Let's use the standard image but configure it to run on 8080 if we were strict, 
# but for now let's stick to standard port 80 inside container for simplicity unless 
# I want to use nginxinc/nginx-unprivileged.
# Let's use nginxinc/nginx-unprivileged for true non-root compliance.)

FROM nginxinc/nginx-unprivileged:alpine
USER root
RUN apk add --no-cache curl
USER 101
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
