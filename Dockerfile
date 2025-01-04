FROM node:18-slim as base
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y poppler-utils

# Stage 1: Frontend build
FROM base AS frontend-builder
WORKDIR /app/frontend
# Copy package files first for better caching
COPY frontend/package*.json ./
# Install ALL dependencies including dev dependencies
RUN npm ci
# Copy frontend source
COPY frontend/ ./
# Build frontend
RUN npm run build

# Stage 2: Backend build  
FROM base AS backend-builder
WORKDIR /app/backend
# Copy package files first for better caching
COPY backend/package*.json ./
# Install ALL dependencies including dev dependencies
RUN npm ci
# Copy backend source
COPY backend/ ./
# Build backend
RUN npm run build

# Stage 3: Production
FROM base
WORKDIR /app

# Copy built assets
COPY --from=frontend-builder /app/frontend/build ./frontend/build
COPY --from=backend-builder /app/backend/dist ./backend/dist

# Copy package files
COPY backend/package*.json ./backend/

# Install only production dependencies
WORKDIR /app/backend
RUN npm ci --omit=dev

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Start command
CMD ["node", "dist/server.js"]
