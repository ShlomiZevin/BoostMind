// URL of the Cloud Run backend. Set by build after deploy.
// Vite env var override wins if present (VITE_CHAT_API_URL).
const FROM_ENV = (import.meta as any).env?.VITE_CHAT_API_URL as string | undefined;
export const CHAT_API_URL =
  FROM_ENV ||
  'https://workout-ai-463727469066.me-west1.run.app';
