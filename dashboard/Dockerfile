# Multi-stage Dockerfile for dashboard
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# ===== Development Stage =====
FROM base AS development

# Install nodemon globally for hot-reloading
RUN npm install -g nodemon

# Install dependencies
RUN npm ci

# Copy application files
COPY . .

# Expose port
EXPOSE 3001

# Use nodemon for hot-reloading
CMD ["nodemon", "server.js"]

# ===== Production Build Stage =====
FROM base AS production-build

# Install only production dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# ===== Production Stage =====
FROM node:18-alpine AS production

# Add curl for healthcheck
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy from build stage
COPY --from=production-build --chown=nodejs:nodejs /app ./

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start the application
CMD ["node", "server.js"]