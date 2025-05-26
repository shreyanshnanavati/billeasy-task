# Use Node.js 22 LTS (Alpine for smaller size)
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for Prisma)
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Create necessary directories
RUN mkdir -p uploads prisma

# Expose port (using 3001 to avoid conflict with local setup)
EXPOSE 3002

# Start the application with database migration
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:prod"] 