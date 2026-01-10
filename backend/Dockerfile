# Dockerfile for Railway with optimized layer caching
# Key optimization: copy package files first, then npm ci, then source code

FROM node:18-slim

# Install Chromium and dependencies for Puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libxshmfence1 \
    libgtk-3-0 \
    libx11-xcb1 \
    fonts-liberation \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# OPTIMIZATION: Copy only package files first
# This layer is cached unless package.json or package-lock.json changes
COPY package.json package-lock.json ./

# Install dependencies - THIS LAYER IS NOW CACHED!
# Only re-runs when package.json or package-lock.json changes
RUN npm ci --prefer-offline --no-audit --no-fund --progress=false

# Copy the rest of the source code
# This layer changes frequently but npm ci is already cached above
COPY . .

# Build TypeScript
RUN npm run build

# Create uploads directory for Railway Volume
RUN mkdir -p /app/uploads/images

# Expose port (Railway uses $PORT)
EXPOSE 3000

# Start command - run migrations then start server
# Using node directly instead of npm to avoid extra process layers
CMD ["sh", "-c", "echo 'Running migrations...' && node migrate.js && echo 'Migrations done, starting server...' && node dist/index.js"]

