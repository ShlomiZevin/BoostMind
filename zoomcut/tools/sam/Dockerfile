# keep.py track on Cloud Run with an NVIDIA L4 (tools/sam/server.py). Built by Cloud Build from tools/sam/ (.gcloudignore:
# only the small model goes in). Meta's sam2 from GitHub, torch with CUDA from the PyTorch image.
FROM pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg git && rm -rf /var/lib/apt/lists/*
ENV SAM2_BUILD_CUDA=0 SAM2_BUILD_ALLOW_ERRORS=1 PYTHONUNBUFFERED=1 TQDM_DISABLE=1 KEEP_DEVICE=cuda
RUN pip install --no-cache-dir "git+https://github.com/facebookresearch/sam2.git" opencv-python-headless google-cloud-storage
WORKDIR /app
COPY models/sam2.1_hiera_small.pt /app/models/sam2.1_hiera_small.pt
COPY keep.py server.py /app/
ENTRYPOINT ["python", "server.py"]
