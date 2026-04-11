import type { APIRoute } from 'astro';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { SolarFaultReportType } from '../../lib/solar-fault-schema';
import { resolveProviders, type ResolvedProvider } from '../../lib/vision-providers';

export const prerender = false;

const SYSTEM_PROMPT = `你是一位资深光伏电站运维工程师和图像分析专家。你的任务是精确分析光伏板图片，识别所有潜在故障和异常。

分析要点：
1. 灰尘覆盖：面板表面是否有灰尘、沙尘或污垢沉积
2. 树叶遮挡：是否有落叶、树枝或植被遮挡面板
3. 鸟粪污染：白色或灰色的鸟类排泄物痕迹
4. 裂纹：面板玻璃或电池片的裂纹、破损
5. 热斑：局部颜色异常、发黄或变色区域
6. 云彩阴影：由云层或建筑物造成的阴影区域
7. 积雪覆盖：面板上的积雪
8. 其他异物：鸟巢、垃圾、杂物等

严重程度判断标准：
- 无：面板完全正常
- 轻微：影响面积 <10%，发电效率损失 <5%
- 中等：影响面积 10-30%，发电效率损失 5-20%
- 严重：影响面积 >30%，发电效率损失 >20%

你必须以纯 JSON 格式返回分析结果（不要包含 markdown 代码块标记），格式如下：
{
  "faults": [
    {
      "type": "正常|灰尘覆盖|树叶遮挡|鸟粪污染|裂纹|热斑|云彩阴影|积雪覆盖|其他异物",
      "severity": "无|轻微|中等|严重",
      "confidence": 0.0到1.0之间的数字,
      "location": "故障位置描述",
      "suggestion": "维护建议"
    }
  ],
  "overallStatus": "正常|需关注|需维护|紧急",
  "summary": "整体总结",
  "estimatedPowerLoss": 0到100之间的数字,
  "maintenancePriority": "低|中|高|紧急",
  "detailedAdvice": "详细维护建议"
}`;

function parseJsonResponse(text: string): SolarFaultReportType {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }
  return JSON.parse(cleaned);
}

interface RecognitionAttempt {
  provider: ResolvedProvider;
  error: string;
}

async function tryProvider(
  provider: ResolvedProvider,
  imageContent: { type: 'image'; image: string | URL },
): Promise<{ text: string } | { error: string }> {
  const openai = createOpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.baseURL,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), provider.timeoutMs);

  try {
    const { text } = await generateText({
      model: openai(provider.model),
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '请仔细分析这张光伏板图片，识别所有故障类型、严重程度，并给出维护建议。只返回 JSON，不要包含其他文字。',
            },
            imageContent,
          ],
        },
      ],
      temperature: 0.1,
      abortSignal: controller.signal,
    });

    parseJsonResponse(text);
    return { text };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg };
  } finally {
    clearTimeout(timer);
  }
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { imageBase64, imageUrl } = body as {
      imageBase64?: string;
      imageUrl?: string;
    };

    if (!imageBase64 && !imageUrl) {
      return new Response(
        JSON.stringify({ error: '请提供图片（base64 或 URL）' }),
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const providers = resolveProviders({
      groq: import.meta.env.GROQ_API_KEY,
      mistral: import.meta.env.MISTRAL_API_KEY,
      glm: import.meta.env.GLM_API_KEY,
      openaiKey: import.meta.env.OPENAI_API_KEY,
      openaiBase: import.meta.env.OPENAI_API_BASE,
      openaiModel: import.meta.env.OPENAI_MODEL,
    });

    if (providers.length === 0) {
      return new Response(
        JSON.stringify({ error: '未配置任何 Vision API 密钥，请在环境变量中配置 GROQ_API_KEY、MISTRAL_API_KEY 或 GLM_API_KEY' }),
        { status: 500, headers: CORS_HEADERS },
      );
    }

    const imageContent = imageBase64
      ? { type: 'image' as const, image: imageBase64 }
      : { type: 'image' as const, image: new URL(imageUrl!) };

    const startTime = Date.now();
    const attempts: RecognitionAttempt[] = [];

    for (const provider of providers) {
      console.log(`[recognize] trying provider: ${provider.id} (${provider.name})`);
      const result = await tryProvider(provider, imageContent);

      if ('text' in result) {
        const object = parseJsonResponse(result.text);
        const processingTime = Date.now() - startTime;

        const predictions = (object.faults || []).map((f) => ({
          label: f.type === '正常' ? '正常光伏板' : f.type,
          confidence: f.confidence,
          severity: f.severity,
          location: f.location,
          suggestion: f.suggestion,
        }));

        const successResponse = {
          status: 'success' as const,
          predictions,
          confidence:
            predictions.length > 0
              ? predictions.reduce((s, p) => s + p.confidence, 0) / predictions.length
              : 0,
          processing_time: processingTime,
          api_used: `${provider.name}`,
          provider_id: provider.id,
          fallback_attempts: attempts.map((a) => ({
            provider: a.provider.id,
            error: a.error,
          })),
          report: {
            overallStatus: object.overallStatus,
            summary: object.summary,
            estimatedPowerLoss: object.estimatedPowerLoss,
            maintenancePriority: object.maintenancePriority,
            detailedAdvice: object.detailedAdvice,
          },
          timestamp: new Date().toISOString(),
        };

        return new Response(JSON.stringify(successResponse), {
          status: 200,
          headers: CORS_HEADERS,
        });
      }

      console.warn(`[recognize] provider ${provider.id} failed: ${result.error}`);
      attempts.push({ provider, error: result.error });
    }

    const failureSummary = attempts
      .map((a) => `${a.provider.name}: ${a.error}`)
      .join(' | ');

    return new Response(
      JSON.stringify({
        status: 'error',
        predictions: [],
        confidence: 0,
        processing_time: Date.now() - startTime,
        api_used: 'none',
        error_message: `所有识别引擎均不可用: ${failureSummary}`,
        tried_providers: attempts.map((a) => a.provider.id),
      }),
      { status: 500, headers: CORS_HEADERS },
    );
  } catch (error) {
    console.error('Recognition API error:', error);
    const message = error instanceof Error ? error.message : '识别服务异常';
    return new Response(
      JSON.stringify({
        status: 'error',
        predictions: [],
        confidence: 0,
        processing_time: 0,
        api_used: 'none',
        error_message: message,
      }),
      { status: 500, headers: CORS_HEADERS },
    );
  }
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
};
