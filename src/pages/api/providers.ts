import type { APIRoute } from 'astro';
import { resolveProviders } from '../../lib/vision-providers';

export const prerender = false;

export const GET: APIRoute = async () => {
  const providers = resolveProviders({
    groq: import.meta.env.GROQ_API_KEY,
    mistral: import.meta.env.MISTRAL_API_KEY,
    glm: import.meta.env.GLM_API_KEY,
    openaiKey: import.meta.env.OPENAI_API_KEY,
    openaiBase: import.meta.env.OPENAI_API_BASE,
    openaiModel: import.meta.env.OPENAI_MODEL,
  });

  const list = providers.map((p) => ({
    id: p.id,
    name: p.name,
    model: p.model,
  }));

  return new Response(
    JSON.stringify({
      providers: list,
      count: list.length,
      fallback_enabled: list.length > 1,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    },
  );
};
