/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend base URL, e.g. "https://clearsign-backend.onrender.com".
   *  Leave unset for local dev — requests stay relative ("/api/...") and
   *  vite.config.ts's dev proxy forwards them to the local backend. */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
