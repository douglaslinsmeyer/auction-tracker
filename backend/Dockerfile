# Multi-stage Dockerfile for development and production
FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Copy package files from backend directory
COPY backend/package*.json ./

# ===== Development Stage =====
FROM base AS development

# Install nodemon globally for hot-reloading
RUN npm install -g nodemon

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy application files from backend directory
COPY backend/ .

# Expose ports (3000 for app, 9229 for debugging)
EXPOSE 3000 9229

# Use nodemon for hot-reloading
CMD ["nodemon", "src/index.js"]

# ===== Production Build Stage =====
FROM base AS production-build

# Install only production dependencies
RUN npm ci --only=production

# Copy application code from backend directory
COPY backend/ .

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

# Create log directory with proper permissions
RUN mkdir -p /app/logs && \
    chown -R nodejs:nodejs /app/logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check using curl (more reliable than node)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "src/index.js"]