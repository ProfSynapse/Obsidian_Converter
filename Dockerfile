# Stage 1: Dependencies
FROM node:18-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
RUN npm install

# Stage 2: Production
FROM node:18-slim
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN apt-get update && apt-get install -y poppler-utils

CMD ["node", "backend/src/server.js"]
