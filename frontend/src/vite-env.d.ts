/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  // readonly VITE_AI_ASSISTANT_ENABLED?: string; // AI plugin (local only)
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
