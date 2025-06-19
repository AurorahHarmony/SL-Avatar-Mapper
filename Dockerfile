# Stage 1: Build
FROM node:20 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Production runtime
FROM node:20 AS runner

WORKDIR /app

# Copy only necessary files from build
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/db ./db  # Prisma sqlite DB if needed
COPY --from=builder /app/public ./public

RUN npm install --omit=dev

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]