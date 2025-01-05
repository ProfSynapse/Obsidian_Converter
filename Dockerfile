FROM node:18-slim as base
WORKDIR /app

RUN apt-get update && apt-get install -y poppler-utils

# Stage 1: Dependencies and Build
FROM base AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json frontend/
COPY backend/package*.json backend/

# Install root dependencies
RUN npm install

# Copy source code
COPY . .

# Build both projects
RUN npm run build

# Stage 2: Production
FROM base
WORKDIR /app

COPY --from=builder /app/frontend/build ./frontend/build
COPY --from=builder /app/backend/dist ./backend/dist
COPY package*.json ./
COPY backend/package*.json backend/

WORKDIR /app/backend
RUN npm install --only=production

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "dist/server.js"]
