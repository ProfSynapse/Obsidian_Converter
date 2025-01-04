# Stage 1: Dependencies
FROM node:18-slim AS builder
WORKDIR /app

# Copy package files and babel config
COPY package*.json .babelrc ./
COPY backend/package*.json ./backend/
RUN npm install

# Copy source code
COPY . .

# Build backend
RUN npm run build:backend

# Stage 2: Production
FROM node:18-slim
WORKDIR /app

# Copy built artifacts and configs
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/backend/package*.json ./backend/
COPY --from=builder /app/.babelrc ./

RUN npm install --production

RUN apt-get update && apt-get install -y poppler-utils

CMD ["node", "dist/server.js"]
