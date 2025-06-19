# Build Stage 1
FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable

# Copy dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy project files
COPY . ./

# Run prisma migrations
RUN npx prisma generate

# Build Nuxt
RUN npm run build

# Runtime Stage
FROM node:22-alpine
WORKDIR /app

# Copy built output
COPY --from=build /app/.output ./
COPY --from=build /app/prisma /app/server/prisma

ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

CMD ["sh", "-c", "cd /app/server && npx prisma migrate deploy && node index.mjs"]