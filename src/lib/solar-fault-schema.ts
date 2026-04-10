import { z } from 'zod';

export const FaultType = z.enum([
  '正常',
  '灰尘覆盖',
  '树叶遮挡',
  '鸟粪污染',
  '裂纹',
  '热斑',
  '云彩阴影',
  '积雪覆盖',
  '其他异物',
]);

export const Severity = z.enum(['无', '轻微', '中等', '严重']);

export const OverallStatus = z.enum(['正常', '需关注', '需维护', '紧急']);

export const FaultItem = z.object({
  type: FaultType,
  severity: Severity,
  confidence: z.number().min(0).max(1),
  location: z.string(),
  suggestion: z.string(),
});

export const SolarFaultReport = z.object({
  faults: z.array(FaultItem),
  overallStatus: OverallStatus,
  summary: z.string(),
  estimatedPowerLoss: z.number().min(0).max(100),
  maintenancePriority: z.enum(['低', '中', '高', '紧急']),
  detailedAdvice: z.string(),
});

export type FaultTypeValue = z.infer<typeof FaultType>;
export type SeverityValue = z.infer<typeof Severity>;
export type FaultItemType = z.infer<typeof FaultItem>;
export type SolarFaultReportType = z.infer<typeof SolarFaultReport>;
