FROM node:18-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache python3 make g++

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
EXPOSE 3101 3102 3103 3000

# Start all apps in development mode
CMD ["npm", "run", "start:dev"] 