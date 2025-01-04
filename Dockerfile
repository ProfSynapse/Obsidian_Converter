# Stage 1: Dependencies
FROM node:18-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
RUN npm install

# Stage 2: Build
COPY . .
RUN cd backend && npm run build

# Stage 3: Production
FROM node:18-slim
WORKDIR /app
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/node_modules ./node_modules
RUN apt-get update && apt-get install -y poppler-utils

CMD ["node", "dist/server.js"]
