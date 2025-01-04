# Stage 1: Dependencies
FROM node:18-slim AS builder
WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies
RUN npm install

# Copy the entire repo
COPY . .

# Build the monorepo (this will run build:frontend && build:backend)
RUN npm run build

# Stage 2: Production
FROM node:18-slim
WORKDIR /app

# Copy built backend artifacts and node_modules
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

RUN apt-get update && apt-get install -y poppler-utils

CMD ["node", "dist/server.js"]
