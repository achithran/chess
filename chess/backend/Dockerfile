FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    LD_LIBRARY_PATH=/app/piper_bin

# Stockfish + espeak-ng (needed by piper binary for phonemization)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       stockfish curl espeak-ng libespeak-ng1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Piper TTS: standalone binary + Indian language voice models (~50 MB each ONNX).
# The binary bundles its own libonnxruntime / libpiper_phonemize / espeak-ng-data.
# LD_LIBRARY_PATH=/app/piper_bin (set above) makes the shared libs visible at runtime.
# All downloads use || true so the build never fails due to network/404 issues —
# the service falls back to Google Cloud TTS or ElevenLabs if models are missing.
RUN PIPER_VER="2023.11.14-2" && \
    mkdir -p /app/piper_bin /app/piper_models && \
    curl -fL --retry 3 -o /tmp/piper.tar.gz \
         "https://github.com/rhasspy/piper/releases/download/${PIPER_VER}/piper_linux_x86_64.tar.gz" \
    && tar -xzf /tmp/piper.tar.gz -C /app/piper_bin --strip-components=1 \
    && rm /tmp/piper.tar.gz \
    || true

# Voice models — downloaded via Python (more reliable TLS than curl for HuggingFace LFS).
# Paths verified from rhasspy/piper-voices voices.json.  || true keeps build alive if
# HuggingFace is unreachable at build time; models can be fetched later via:
#   docker exec <container> python download_piper_models.py
COPY download_piper_models.py .
RUN python download_piper_models.py || true

COPY . .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD sh -c "curl -f http://localhost:${PORT:-8000}/api/v1/health || exit 1"

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
