FROM node:20-alpine AS builder

WORKDIR /app

ARG INTERNAL_API_URL=http://localhost:4000
ENV INTERNAL_API_URL=${INTERNAL_API_URL}

COPY package.json .
RUN npm install

COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
