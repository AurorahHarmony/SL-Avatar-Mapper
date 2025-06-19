# Build Stage 1
FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable

# Copy dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy project files
COPY . ./

# Build Nuxt
RUN npm run build

# Runtime Stage
FROM node:22-alpine
WORKDIR /app

# Copy built output
COPY --from=build /app/.output ./

ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

CMD ["node", "/app/server/index.mjs"]