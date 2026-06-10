FROM node:20-alpine

WORKDIR /app

# Copy dependency definition files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy frontend source files
COPY . .

# Expose Vite development server port
EXPOSE 5173

# Start Vite dev server binding to 0.0.0.0
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
