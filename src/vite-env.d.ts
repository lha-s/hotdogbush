/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_TOKEN_TICKER?: string;
  readonly VITE_PUMPFUN_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
