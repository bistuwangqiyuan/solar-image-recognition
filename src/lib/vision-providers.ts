export interface VisionProvider {
  id: string;
  name: string;
  baseURL: string;
  model: string;
  timeoutMs: number;
}

export interface ResolvedProvider extends VisionProvider {
  apiKey: string;
}

interface ProviderKeys {
  groq?: string;
  mistral?: string;
  glm?: string;
  openaiKey?: string;
  openaiBase?: string;
  openaiModel?: string;
}

const PROVIDER_DEFS: VisionProvider[] = [
  {
    id: 'groq',
    name: 'Groq Llama 4 Scout',
    baseURL: 'https://api.groq.com/openai/v1',
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    timeoutMs: 30_000,
  },
  {
    id: 'mistral',
    name: 'Mistral Pixtral Large',
    baseURL: 'https://api.mistral.ai/v1',
    model: 'pixtral-large-latest',
    timeoutMs: 30_000,
  },
  {
    id: 'glm',
    name: '智谱 GLM-4V',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4v-flash',
    timeoutMs: 45_000,
  },
];

export function resolveProviders(keys: ProviderKeys): ResolvedProvider[] {
  const keyMap: Record<string, string | undefined> = {
    groq: keys.groq,
    mistral: keys.mistral,
    glm: keys.glm,
  };

  const resolved: ResolvedProvider[] = [];

  for (const def of PROVIDER_DEFS) {
    const apiKey = keyMap[def.id];
    if (apiKey) {
      resolved.push({ ...def, apiKey });
    }
  }

  if (keys.openaiKey && keys.openaiBase) {
    const alreadyCovered = resolved.some(
      (p) => p.baseURL === keys.openaiBase || p.apiKey === keys.openaiKey,
    );
    if (!alreadyCovered) {
      resolved.push({
        id: 'custom',
        name: `Custom (${keys.openaiModel || 'gpt-4o'})`,
        baseURL: keys.openaiBase,
        model: keys.openaiModel || 'gpt-4o',
        timeoutMs: 30_000,
        apiKey: keys.openaiKey,
      });
    }
  }

  return resolved;
}
