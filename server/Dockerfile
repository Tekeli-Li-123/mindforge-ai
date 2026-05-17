# ===== Build stage =====
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ===== Production stage =====
FROM node:22-alpine AS production

WORKDIR /app

# Copy built artifacts
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

# Ensure the data directory is writable (SQLite)
RUN mkdir -p /app/data

EXPOSE 3001

CMD ["node", "dist/index.js"]