FROM node:18-alpine

WORKDIR /app

# Install iputils for ping and nmap for discovery
RUN apk add --no-cache iputils nmap

COPY package.json .
RUN npm install --production

COPY . .

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

CMD ["node", "server.js"]
