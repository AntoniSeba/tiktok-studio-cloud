# Sandbox image for one generator job: opencode (agent), Node 22 + npx hyperframes (render),
# Chromium deps, ffmpeg, Python with numpy/Pillow/faster-whisper (captions).
# The job container sees only its own job folder, the read-only kit and the workspace
# cutout library. It never sees the Studio database or .env.
#   docker build -f deploy/generator.Dockerfile -t tiktok-studio-gen .
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg poppler-utils python3 python3-pip python3-numpy python3-pil python3-yaml python3-fonttools python3-brotli curl ca-certificates unzip \
      fonts-dejavu-core libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
      libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 \
    && pip3 install --break-system-packages --no-cache-dir faster-whisper \
    && rm -rf /var/lib/apt/lists/*

# Claude Code (headless engine, needs ANTHROPIC_API_KEY passed per job)
RUN npm install -g @anthropic-ai/claude-code

# opencode CLI and a warm hyperframes (so jobs do not download it every time)
RUN curl -fsSL https://opencode.ai/install | bash \
    && ln -s /root/.opencode/bin/opencode /usr/local/bin/opencode \
    && npx --yes hyperframes@0.8.58 --version || true

# whisper "base" model baked in, so captions work offline
RUN python3 -c "from faster_whisper import WhisperModel; WhisperModel('base', device='cpu', compute_type='int8')"

WORKDIR /job
