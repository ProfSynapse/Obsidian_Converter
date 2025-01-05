FROM node:18-slim as base
WORKDIR /app

RUN apt-get update && apt-get install -y poppler-utils

# Stage 1: Frontend build
FROM base AS frontend-builder
WORKDIR /app
# Copy package files first for better caching
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/
# Install ALL dependencies including dev dependencies
RUN npm install
# Copy frontend source
WORKDIR /app/frontend
COPY frontend/ ./
RUN npm run build

# Stage 2: Backend build  
FROM base AS backend-builder
WORKDIR /app
# Copy package files first for better caching
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/
# Install ALL dependencies
RUN npm install
# Copy backend source
WORKDIR /app/backend
COPY backend/ ./
RUN npm run build

# Stage 3: Production
FROM base
WORKDIR /app

# Copy built assets
COPY --from=frontend-builder /app/frontend/build ./frontend/build
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install production dependencies
WORKDIR /app/backend
RUN npm install --only=production

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "dist/server.js"]
