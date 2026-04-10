/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly OPENAI_API_KEY: string;
  readonly OPENAI_API_BASE?: string;
  readonly OPENAI_MODEL?: string;
  readonly ALIYUN_ACCESS_KEY_ID?: string;
  readonly ALIYUN_ACCESS_KEY_SECRET?: string;
  readonly BAIDU_API_KEY?: string;
  readonly BAIDU_SECRET_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

