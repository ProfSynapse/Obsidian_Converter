FROM node:18-slim as base
WORKDIR /app

RUN apt-get update && apt-get install -y poppler-utils

# Stage 1: Frontend build
FROM base AS frontend-builder
WORKDIR /app
# Copy all package manifests for the monorepo
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/
# Install all dependencies for the entire workspace
RUN npm install

# Copy frontend source, then build
WORKDIR /app/frontend
COPY frontend/ ./
RUN npm run build

# Stage 2: Backend build
FROM base AS backend-builder
WORKDIR /app
# Copy all package manifests for the monorepo
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/
# Install all dependencies for the entire workspace
RUN npm install
# Copy backend source, then build
WORKDIR /app/backend
COPY backend/ ./
RUN npm run build

# Stage 3: Production
FROM base
WORKDIR /app

COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
COPY --from=backend-builder /app/backend/dist ./backend/dist

WORKDIR /app/backend
RUN npm ci --omit=dev

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "dist/server.js"]
