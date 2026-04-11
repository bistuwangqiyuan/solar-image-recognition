/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly GROQ_API_KEY?: string;
  readonly MISTRAL_API_KEY?: string;
  readonly GLM_API_KEY?: string;
  readonly OPENAI_API_KEY?: string;
  readonly OPENAI_API_BASE?: string;
  readonly OPENAI_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
