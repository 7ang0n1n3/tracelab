FROM mcr.microsoft.com/playwright:v1.42.1-jammy

WORKDIR /app

# Install Xvfb for headless display support (needed for headed mode)
RUN apt-get update && apt-get install -y xvfb && rm -rf /var/lib/apt/lists/*

COPY package.json .
RUN npm install

COPY tsconfig.json .
COPY src ./src

RUN npm run build

# Start Xvfb on display :99 then run the runner
CMD Xvfb :99 -screen 0 1280x720x24 & node dist/index.js
