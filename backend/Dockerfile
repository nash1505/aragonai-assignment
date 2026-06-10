FROM node:20-alpine

# Install openssl (required for Prisma Client to run on Alpine)
RUN apk add --no-cache openssl

WORKDIR /app

# Copy dependency definition files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy Prisma directory first to allow Prisma client generation
COPY prisma ./prisma/

# Generate Prisma Client
RUN npx prisma generate

# Copy the rest of the application files
COPY . .

# Expose the server port
EXPOSE 3001

# Default command to start the backend in dev mode
CMD ["npm", "run", "dev"]
