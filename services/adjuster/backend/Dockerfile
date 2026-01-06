FROM node:20-bookworm-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 make g++ ca-certificates openssl libssl3 procps \
  && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY nest-cli.json ./
COPY tsconfig*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build each app separately
RUN npm run build changes-detector && \
    npm run build changes-suggester && \
    npm run build dialogs-handler && \
    npm run build dataspecer-adapter

# Expose ports for all services
EXPOSE 3101 3102 3100 3000

# Start all apps in development mode
CMD ["npm", "run", "start:dev"] 