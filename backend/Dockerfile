FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends zip && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json .
RUN npm install

COPY tsconfig.json .
COPY src ./src

RUN npm run build

EXPOSE 4000
CMD ["node", "dist/index.js"]
