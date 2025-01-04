# Stage 1: Dependencies
FROM node:18-slim AS builder
WORKDIR /app

# Copy package files and babel config
COPY package*.json .babelrc ./
COPY backend/package*.json ./backend/

# Install all dependencies including devDependencies
RUN npm install

# Copy source code
COPY . .

# Build backend
RUN npm run build:backend

# Stage 2: Production
FROM node:18-slim
WORKDIR /app

# Copy necessary files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/backend/package*.json ./backend/
COPY --from=builder /app/.babelrc ./

# Install production dependencies at the root and in backend
RUN npm install --production && \
    cd backend && npm install --production && cd ..

# Install system dependencies
RUN apt-get update && apt-get install -y poppler-utils

# Set environment variable
ENV NODE_ENV=production

CMD ["node", "dist/server.js"]
