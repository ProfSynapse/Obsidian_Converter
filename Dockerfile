# Use node:18-slim
FROM node:18-slim AS base
WORKDIR /app

RUN apt-get update && apt-get install -y \
    poppler-utils \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package*.json ./
RUN npm install --include=dev

# Copy server code
COPY . .

ENV NODE_ENV=production
ENV PORT=8080

# Remove build steps referencing "backend" or "dist"
CMD ["node", "server.js"]
