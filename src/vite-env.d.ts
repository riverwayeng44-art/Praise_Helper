/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BRIDGE_BASE_URL?: string;
  readonly VITE_BRIDGE_API_KEY?: string;
  readonly VITE_BRIDGE_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
