FROM node:20-slim

# Install Chrome + Xvfb (virtual display so Chrome thinks it's on a real screen)
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    apt-transport-https \
    xvfb \
    --no-install-recommends

# Install Google Chrome
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y \
        google-chrome-stable \
        fonts-ipafont-gothic \
        fonts-wqy-zenhei \
        fonts-thai-tlwg \
        fonts-kacst \
        fonts-freefont-ttf \
        libxss1 \
        libnss3 \
        libatk-bridge2.0-0 \
        libdrm2 \
        libxkbcommon0 \
        libgbm1 \
        libasound2 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV CHROME_PATH=/usr/bin/google-chrome-stable
ENV DISPLAY=:99

WORKDIR /usr/src/app

# Install root-level dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Install backend runtime dependencies
COPY backend/package*.json ./backend/
RUN npm install --omit=dev --prefix ./backend

# Copy all application files (including pre-built backend/dist/)
COPY . .

EXPOSE 3000

# Start Xvfb virtual display first, then the Node app
CMD Xvfb :99 -screen 0 1280x900x24 -ac +extension GLX +render -noreset & sleep 1 && node server.js
