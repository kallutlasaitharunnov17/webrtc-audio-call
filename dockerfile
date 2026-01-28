FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source code
COPY . .

# Expose ports
EXPOSE 8080

# Start server
CMD ["node", "server.js"]
