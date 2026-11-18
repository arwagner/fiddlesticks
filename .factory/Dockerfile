# The factory's runner image, plus agent-browser and its Chrome, so agents can drive the games.
# agent-browser's own `install --with-deps` wants sudo, which the image has no use for: its packages are here.
ARG FACTORY_IMAGE
FROM ${FACTORY_IMAGE}
USER root
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libxcb-shm0 libx11-xcb1 libx11-6 libxcb1 libxext6 libxrandr2 libxcomposite1 libxcursor1 libxdamage1 \
    libxfixes3 libxi6 libgtk-3-0 libpangocairo-1.0-0 libpango-1.0-0 libatk1.0-0 libcairo-gobject2 libcairo2 \
    libgdk-pixbuf-2.0-0 libxrender1 libasound2 libfreetype6 libfontconfig1 libdbus-1-3 libnss3 libnspr4 \
    libatk-bridge2.0-0 libdrm2 libxkbcommon0 libatspi2.0-0 libcups2 libxshmfence1 libgbm1 \
    fonts-noto-color-emoji fonts-noto-cjk fonts-freefont-ttf \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g agent-browser@0.27.0
USER node
RUN agent-browser install
