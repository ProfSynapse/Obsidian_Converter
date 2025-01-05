FROM node:18-slim as base
WORKDIR /app

RUN apt-get update && apt-get install -y poppler-utils

# Stage 1: Dependencies and Build
FROM base AS builder
WORKDIR /app

# Copy all package files first
COPY package*.json ./
COPY frontend/package*.json frontend/
COPY backend/package*.json backend/

# Install root dependencies first
RUN npm install

# Copy source code
COPY . .

# Build both projects
RUN npm run build

# Stage 2: Production
FROM base
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json backend/

# Install production dependencies using regular npm install
RUN npm install --only=production --workspace=backend
RUN npm install --only=production

# Copy built assets
COPY --from=builder /app/frontend/build ./frontend/build
COPY --from=builder /app/backend/dist ./dist

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "dist/server.js"]
