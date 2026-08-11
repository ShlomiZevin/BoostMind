#!/usr/bin/env bash
# One-shot deploy: verifies auth, sets project, ensures secret + APIs exist, deploys Cloud Run.
# Usage:  ANTHROPIC_API_KEY=sk-ant-... ./deploy.sh
#         (API key is optional — if omitted, the existing Secret Manager entry is reused.)

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-boostmind-b052c}"
SERVICE_NAME="${SERVICE_NAME:-workout-ai}"
REGION="${REGION:-me-west1}"
SECRET_NAME="ANTHROPIC_API_KEY"

# ─── Auth check ─────────────────────────────────────────────────────────
# Try a lightweight token fetch. If auth is expired / never set, guide the user through login.
if ! gcloud auth print-access-token >/dev/null 2>&1; then
  echo "✗ gcloud is not authenticated (or the token has expired)."
  echo ""
  echo "  Run these two commands (each opens a browser tab):"
  echo "    gcloud auth login"
  echo "    gcloud auth application-default login"
  echo ""
  echo "  Then re-run this script."
  exit 1
fi

ACTIVE_ACCOUNT="$(gcloud config get-value account 2>/dev/null || echo '(none)')"

# ─── Project setup ──────────────────────────────────────────────────────
echo "▸ Active account: $ACTIVE_ACCOUNT"
echo "▸ Setting project to $PROJECT_ID"
gcloud config set project "$PROJECT_ID" >/dev/null

# Also align the application-default credentials' quota project so we stop seeing the noisy
# "your active project does not match the quota project" warning during deploys.
# Silent if ADC file doesn't exist yet — that's fine.
if [[ -f "${HOME}/.config/gcloud/application_default_credentials.json" ]] \
   || [[ -f "${APPDATA:-}/gcloud/application_default_credentials.json" ]]; then
  gcloud auth application-default set-quota-project "$PROJECT_ID" >/dev/null 2>&1 || true
fi

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

SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(status.url)')"
echo ""
echo "✓ Deployed"
echo "  Project : $PROJECT_ID"
echo "  Service : $SERVICE_NAME ($REGION)"
echo "  Account : $ACTIVE_ACCOUNT"
echo "  URL     : $SERVICE_URL"
