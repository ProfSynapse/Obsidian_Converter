FROM node:18-slim as base
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y poppler-utils

# Stage 1: Frontend build
FROM base AS frontend-builder
WORKDIR /app/frontend
# Copy root package files first
COPY package*.json ./
COPY frontend/package*.json ./
# Install dependencies at root level for workspaces
RUN npm install
# Copy frontend source
COPY frontend/ ./
# Build frontend with explicit path to vite
RUN npm exec vite build

# Stage 2: Backend build  
FROM base AS backend-builder
WORKDIR /app/backend
# Copy package files
COPY package*.json ./
COPY backend/package*.json ./
# Install dependencies
RUN npm install
# Copy backend source
COPY backend/ ./
# Build backend
RUN npm run build

# Stage 3: Production
FROM base
WORKDIR /app

# Copy built assets correctly
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
COPY --from=backend-builder /app/backend/dist ./backend/dist

# Install only production dependencies
WORKDIR /app/backend
RUN npm ci --omit=dev

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Start command
CMD ["node", "dist/server.js"]
