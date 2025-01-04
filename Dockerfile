# Stage 1: Dependencies
FROM node:18-slim AS builder
WORKDIR /app

# Copy entire repo so frontend folder exists
COPY . .

# Install dependencies
RUN npm install

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
