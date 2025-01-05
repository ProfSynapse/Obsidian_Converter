# Use node:18-slim
FROM node:18-slim AS base
WORKDIR /app

# Install required system dependencies including complete Poppler tools
RUN apt-get update && apt-get install -y \
    poppler-utils \
    poppler-data \
    ffmpeg \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Verify poppler-utils installation
RUN pdftoppm -v && pdfinfo -v

# Install dependencies
COPY package*.json ./
RUN npm install --include=dev

# Copy server code
COPY . .

ENV NODE_ENV=production
ENV PORT=8080
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Remove build steps referencing "backend" or "dist"
CMD ["node", "server.js"]
