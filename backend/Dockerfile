# Build stage
FROM node:20-slim AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy source
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# Create uploads directory
RUN mkdir -p storage/uploads

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
