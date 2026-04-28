FROM mcr.microsoft.com/playwright:v1.59.1-jammy

WORKDIR /app

# Install Xvfb, x11vnc, and noVNC (websockify) for in-browser codegen recording
RUN DEBIAN_FRONTEND=noninteractive apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      xvfb x11vnc novnc python3-websockify && \
    rm -rf /var/lib/apt/lists/*

COPY package.json .
RUN npm install

COPY tsconfig.json .
COPY src ./src

RUN npm run build

# Remove stale Xvfb lock (survives container restarts), then start Xvfb and the runner
CMD rm -f /tmp/.X99-lock && Xvfb :99 -screen 0 1280x720x24 & node dist/index.js
