# BiRefNet-portrait cut-out on Cloud Run (L4) - tools/birefnet/cloud.py runs it. Built by Cloud Build from this folder.
FROM pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
ENV PYTHONUNBUFFERED=1 HF_HOME=/models TQDM_DISABLE=1
RUN pip install --no-cache-dir "transformers==4.46.3" timm kornia einops google-cloud-storage
RUN python -c "from transformers import AutoModelForImageSegmentation as A; A.from_pretrained('ZhengPeng7/BiRefNet-portrait', trust_remote_code=True)"
WORKDIR /app
COPY run.py /app/
ENTRYPOINT ["python", "run.py"]
