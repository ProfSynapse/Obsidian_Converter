# Stage 1: Dependencies
FROM node:18-slim AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/
RUN npm install

# Copy entire repo so frontend folder exists
COPY . .

# Now run the build
RUN npm run build

# Stage 2: Production
FROM node:18-slim
WORKDIR /app

# Copy built backend artifacts and node_modules
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

RUN apt-get update && apt-get install -y poppler-utils

CMD ["node", "dist/server.js"]
