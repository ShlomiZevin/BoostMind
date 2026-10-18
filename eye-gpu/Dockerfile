FROM pytorch/pytorch:2.3.1-cuda12.1-cudnn8-runtime
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg git libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN pip install --no-cache-dir "numpy<2" opencv-python-headless==4.10.0.84 mediapipe==0.10.14 scipy imageio pyyaml rich \
    fastapi "uvicorn[standard]" google-cloud-storage huggingface_hub
# LivePortrait (MIT) at a fixed commit, with only its own four networks + the stitching module baked in
RUN git clone https://github.com/KwaiVGI/LivePortrait.git /app/LivePortrait && cd /app/LivePortrait && git checkout 9b294b3d0536135442ea73cb01e6cb3ca7029dd3
RUN python -c "from huggingface_hub import snapshot_download; snapshot_download('KwaiVGI/LivePortrait', local_dir='/app/LivePortrait/pretrained_weights', allow_patterns=['liveportrait/base_models/*', 'liveportrait/retargeting_models/*'])"
COPY eyes.py server.py face_landmarker.task ./
ENV LP_REPO=/app/LivePortrait PYTHONUNBUFFERED=1 FFMPEG=/usr/bin/ffmpeg
CMD exec uvicorn server:app --host 0.0.0.0 --port ${PORT:-8080}
