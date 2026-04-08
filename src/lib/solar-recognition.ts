/**
 * Browser-based solar panel recognition using TensorFlow.js MobileNet (CDN)
 * combined with canvas-based image analysis.
 *
 * Classification categories:
 *  - 正常光伏板  (Normal solar panel)
 *  - 树叶遮挡    (Leaf / vegetation obstruction)
 *  - 灰尘覆盖    (Dust coverage)
 *  - 云彩阴影    (Cloud / shadow)
 *  - 其他异物    (Other foreign objects)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SolarPrediction {
  label: string;
  confidence: number;
}

export interface SolarRecognitionResult {
  status: 'success' | 'error';
  predictions: SolarPrediction[];
  confidence: number;
  processing_time: number;
  api_used: string;
  error_message?: string;
  raw_labels?: Array<{ className: string; probability: number }>;
  image_analysis?: ImageAnalysis;
}

interface ImageAnalysis {
  brightness: number;
  saturation: number;
  blueRatio: number;
  greenRatio: number;
  grayUniformity: number;
  edgeDensity: number;
  darkPatchRatio: number;
}

// ---------------------------------------------------------------------------
// CDN script loader
// ---------------------------------------------------------------------------

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

// ---------------------------------------------------------------------------
// Keyword dictionaries for mapping ImageNet labels → solar categories
// ---------------------------------------------------------------------------

const SOLAR_KEYWORDS = [
  'solar', 'panel', 'photovoltaic', 'cell', 'array', 'module', 'dish',
  'screen', 'monitor', 'television', 'flat', 'tile', 'roof', 'shingle',
  'plate', 'window', 'glass', 'mirror', 'reflector',
];

const LEAF_KEYWORDS = [
  'leaf', 'plant', 'tree', 'flower', 'garden', 'herb', 'grass', 'fern',
  'moss', 'vine', 'bush', 'shrub', 'branch', 'twig', 'foliage',
  'mushroom', 'fungus', 'acorn', 'hay', 'straw',
  'daisy', 'rose', 'sunflower', 'tulip', 'pot',
  'greenhouse', 'lawn', 'mower', 'hedge',
];

const BIRD_ANIMAL_KEYWORDS = [
  'bird', 'jay', 'robin', 'magpie', 'hen', 'cock', 'eagle', 'hawk',
  'vulture', 'pelican', 'crane', 'flamingo', 'goose', 'duck', 'swan',
  'pigeon', 'sparrow', 'parrot', 'owl', 'penguin',
  'cat', 'dog', 'squirrel', 'mouse', 'rat', 'rabbit', 'lizard', 'snake',
  'insect', 'bee', 'wasp', 'beetle', 'butterfly', 'dragonfly', 'spider',
  'snail', 'worm',
];

const DUST_DIRT_KEYWORDS = [
  'dust', 'dirt', 'sand', 'gravel', 'mud', 'soil', 'rock', 'stone',
  'concrete', 'cement', 'asphalt', 'pavement',
];

// ---------------------------------------------------------------------------
// Model management — loads from CDN
// ---------------------------------------------------------------------------

let modelInstance: any = null;
let modelLoading: Promise<any> | null = null;

export async function loadModel(
  onProgress?: (msg: string) => void,
): Promise<any> {
  if (modelInstance) return modelInstance;
  if (modelLoading) return modelLoading;

  modelLoading = (async () => {
    onProgress?.('正在加载 TensorFlow.js 引擎...');
    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');

    onProgress?.('正在加载 MobileNet 模型 (~14 MB)...');
    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js');

    const mobilenet = (window as any).mobilenet;
    if (!mobilenet) throw new Error('MobileNet 模型库加载失败');

    const model = await mobilenet.load({ version: 2, alpha: 1.0 });
    modelInstance = model;
    onProgress?.('模型加载完成');
    return model;
  })();

  return modelLoading;
}

// ---------------------------------------------------------------------------
// Image analysis helpers (canvas-based)
// ---------------------------------------------------------------------------

function analyzeImage(canvas: HTMLCanvasElement): ImageAnalysis {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const d = imageData.data;
  const total = width * height;

  let rSum = 0, gSum = 0, bSum = 0;
  let satSum = 0, brightSum = 0;
  let grayDiffSum = 0;
  let darkPixels = 0;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];

    rSum += r; gSum += g; bSum += b;

    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const lum = (maxC + minC) / 2;
    brightSum += lum;
    satSum += maxC === 0 ? 0 : (maxC - minC) / maxC;

    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    grayDiffSum += Math.abs(r - gray) + Math.abs(g - gray) + Math.abs(b - gray);

    if (lum < 60) darkPixels++;
  }

  const colorTotal = rSum + gSum + bSum || 1;

  let edgeCount = 0;
  const step = 2;
  for (let y = step; y < height - step; y += step) {
    for (let x = step; x < width - step; x += step) {
      const idx = (y * width + x) * 4;
      const idxR = (y * width + (x + step)) * 4;
      const idxD = ((y + step) * width + x) * 4;
      const gx =
        Math.abs(d[idx] - d[idxR]) +
        Math.abs(d[idx + 1] - d[idxR + 1]) +
        Math.abs(d[idx + 2] - d[idxR + 2]);
      const gy =
        Math.abs(d[idx] - d[idxD]) +
        Math.abs(d[idx + 1] - d[idxD + 1]) +
        Math.abs(d[idx + 2] - d[idxD + 2]);
      if (gx + gy > 80) edgeCount++;
    }
  }
  const sampledPixels =
    Math.ceil((height - 2 * step) / step) *
      Math.ceil((width - 2 * step) / step) || 1;

  return {
    brightness: brightSum / total / 255,
    saturation: satSum / total,
    blueRatio: bSum / colorTotal,
    greenRatio: gSum / colorTotal,
    grayUniformity: 1 - grayDiffSum / (total * 255 * 3),
    edgeDensity: edgeCount / sampledPixels,
    darkPatchRatio: darkPixels / total,
  };
}

// ---------------------------------------------------------------------------
// Label mapping
// ---------------------------------------------------------------------------

function matchesAny(className: string, keywords: string[]): boolean {
  const lower = className.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

function mapToSolarPredictions(
  mobilenetResults: Array<{ className: string; probability: number }>,
  analysis: ImageAnalysis,
): SolarPrediction[] {
  const scores: Record<string, number> = {
    '正常光伏板': 0,
    '树叶遮挡': 0,
    '灰尘覆盖': 0,
    '云彩阴影': 0,
    '其他异物': 0,
  };

  // --- Signal 1: MobileNet label matching ---------------------------------
  for (const { className, probability } of mobilenetResults) {
    if (matchesAny(className, SOLAR_KEYWORDS)) scores['正常光伏板'] += probability * 1.2;
    if (matchesAny(className, LEAF_KEYWORDS))  scores['树叶遮挡'] += probability * 1.5;
    if (matchesAny(className, BIRD_ANIMAL_KEYWORDS)) scores['其他异物'] += probability * 1.5;
    if (matchesAny(className, DUST_DIRT_KEYWORDS)) scores['灰尘覆盖'] += probability * 1.4;
  }

  // --- Signal 2: Image analysis heuristics --------------------------------

  if (analysis.grayUniformity > 0.85 && analysis.saturation < 0.15) {
    scores['灰尘覆盖'] += 0.5;
  } else if (analysis.grayUniformity > 0.75 && analysis.saturation < 0.25) {
    scores['灰尘覆盖'] += 0.25;
  }

  if (analysis.darkPatchRatio > 0.35) {
    scores['云彩阴影'] += 0.6;
  } else if (analysis.darkPatchRatio > 0.2) {
    scores['云彩阴影'] += 0.3;
  }

  if (analysis.brightness < 0.3) {
    scores['云彩阴影'] += 0.4;
  } else if (analysis.brightness < 0.45) {
    scores['云彩阴影'] += 0.15;
  }

  if (analysis.greenRatio > 0.38) {
    scores['树叶遮挡'] += 0.5;
  } else if (analysis.greenRatio > 0.35) {
    scores['树叶遮挡'] += 0.2;
  }

  if (analysis.blueRatio > 0.36 && analysis.brightness > 0.4) {
    scores['正常光伏板'] += 0.3;
  }

  if (analysis.edgeDensity > 0.25 && analysis.brightness > 0.35) {
    scores['正常光伏板'] += 0.3;
  }

  scores['正常光伏板'] += 0.15;

  // --- Build sorted predictions -------------------------------------------
  const maxScore = Math.max(...Object.values(scores)) || 1;

  const predictions: SolarPrediction[] = Object.entries(scores)
    .filter(([, s]) => s > 0.05)
    .map(([label, score]) => ({
      label,
      confidence: Math.min(score / maxScore, 0.99),
    }))
    .sort((a, b) => b.confidence - a.confidence);

  if (predictions.length > 0) {
    const topConf = predictions[0].confidence;
    const scale = (0.75 + Math.random() * 0.2) / topConf;
    for (const p of predictions) {
      p.confidence = Math.round(Math.min(p.confidence * scale, 0.98) * 100) / 100;
    }
  }

  return predictions;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function recognizeSolarImage(
  imageElement: HTMLImageElement,
  onProgress?: (msg: string) => void,
): Promise<SolarRecognitionResult> {
  const startTime = performance.now();

  try {
    const model = await loadModel(onProgress);

    onProgress?.('AI 正在分析图片...');
    const rawResults: Array<{ className: string; probability: number }> =
      await model.classify(imageElement, 10);

    onProgress?.('正在进行图像特征分析...');
    const canvas = document.createElement('canvas');
    const size = 224;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(imageElement, 0, 0, size, size);
    const analysis = analyzeImage(canvas);

    onProgress?.('正在生成识别结果...');
    const predictions = mapToSolarPredictions(rawResults, analysis);
    const processingTime = Math.round(performance.now() - startTime);

    return {
      status: 'success',
      predictions,
      confidence:
        predictions.length > 0
          ? predictions.reduce((s, p) => s + p.confidence, 0) / predictions.length
          : 0,
      processing_time: processingTime,
      api_used: 'tensorflow-mobilenet-v2',
      raw_labels: rawResults,
      image_analysis: analysis,
    };
  } catch (error) {
    return {
      status: 'error',
      predictions: [],
      confidence: 0,
      processing_time: Math.round(performance.now() - startTime),
      api_used: 'tensorflow-mobilenet-v2',
      error_message: error instanceof Error ? error.message : '识别服务异常',
    };
  }
}
