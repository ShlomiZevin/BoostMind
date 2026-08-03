#!/usr/bin/env bash
# One-shot deploy: sets project, ensures secret + APIs exist, deploys Cloud Run.
# Usage:  ANTHROPIC_API_KEY=sk-ant-... ./deploy.sh
# On first run only: run `gcloud auth login` first if the CLI complains.

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-boostmind-b052c}"
SERVICE_NAME="${SERVICE_NAME:-workout-ai}"
REGION="${REGION:-me-west1}"
SECRET_NAME="ANTHROPIC_API_KEY"

echo "▸ Setting project to $PROJECT_ID"
gcloud config set project "$PROJECT_ID" >/dev/null

echo "▸ Enabling required APIs (idempotent)"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com >/dev/null

if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  echo "! ANTHROPIC_API_KEY env var not set. Skipping secret creation."
  echo "  If the secret already exists in Secret Manager, that's fine."
  echo "  Otherwise, run:  ANTHROPIC_API_KEY=sk-ant-... ./deploy.sh"
else
  if gcloud secrets describe "$SECRET_NAME" >/dev/null 2>&1; then
    echo "▸ Updating existing secret $SECRET_NAME (new version)"
    printf '%s' "$ANTHROPIC_API_KEY" | gcloud secrets versions add "$SECRET_NAME" --data-file=- >/dev/null
  else
    echo "▸ Creating secret $SECRET_NAME"
    printf '%s' "$ANTHROPIC_API_KEY" | gcloud secrets create "$SECRET_NAME" --replication-policy=automatic --data-file=- >/dev/null
  fi
fi

echo "▸ Deploying $SERVICE_NAME to Cloud Run ($REGION)"
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-secrets="ANTHROPIC_API_KEY=${SECRET_NAME}:latest" \
  --memory=512Mi \
  --cpu=1 \
  --max-instances=3 \
  --timeout=60

echo ""
echo "✓ Deployed. Service URL:"
gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(status.url)'
