FROM node:18-slim as base
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y poppler-utils

# Stage 1: Frontend build
FROM base AS frontend-builder
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Backend build
FROM base AS backend-builder
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install
COPY backend/ ./
RUN npm run build

# Stage 3: Production
FROM base
WORKDIR /app

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
# Copy built backend
COPY --from=backend-builder /app/backend/dist ./backend/dist

# Copy package files
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install production dependencies
WORKDIR /app/backend
RUN npm install --production

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Start command
CMD ["node", "dist/server.js"]
