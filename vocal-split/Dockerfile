FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir demucs soundfile fastapi "uvicorn[standard]" python-multipart
# bake the model into the image so a cold start doesn't download it
RUN python -c "from demucs.pretrained import get_model; get_model('htdemucs')"
COPY server.py .
ENV CACHE_DIR=/tmp/cache PYTHONUNBUFFERED=1
CMD exec uvicorn server:app --host 0.0.0.0 --port ${PORT:-8080}
