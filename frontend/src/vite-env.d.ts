/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_FEATURE_VENUE_BLOCKS?: string
  readonly VITE_FEATURE_VENUE_SUITABILITY?: string
  readonly VITE_FEATURE_VENUE_MANAGEMENT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
