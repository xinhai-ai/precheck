/**
 * 指纹风控常量定义
 */

// 风险评分权重
export const RISK_SCORE_WEIGHTS = {
  // 同一 visitorId 关联多个用户
  SAME_VISITOR_ID: 50,
  // Canvas 哈希相同
  SAME_CANVAS_HASH: 20,
  // WebGL 渲染器相同
  SAME_WEBGL_RENDERER: 15,
  // 同一 IP /24 网段
  SAME_IP_SUBNET: 10,
  // 注册时间接近（1 小时内）
  CLOSE_REGISTRATION_TIME: 15,
  // 不同时区（可能是误判）
  DIFFERENT_TIMEZONE: -10,
  // 不同语言（可能是误判）
  DIFFERENT_LANGUAGE: -5,
} as const;

// 风险等级阈值
export const RISK_LEVEL_THRESHOLDS = {
  LOW: 30, // < 30: 低风险
  MEDIUM: 70, // 30-70: 中风险
  // > 70: 高风险
} as const;

// 风险等级
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * 根据分数获取风险等级
 */
export function getRiskLevel(score: number): RiskLevel {
  if (score < RISK_LEVEL_THRESHOLDS.LOW) return 'low';
  if (score < RISK_LEVEL_THRESHOLDS.MEDIUM) return 'medium';
  return 'high';
}

/**
 * 风险等级对应的颜色
 */
export const RISK_LEVEL_COLORS: Record<RiskLevel, string> = {
  low: 'green',
  medium: 'yellow',
  high: 'red',
};

/**
 * 风险等级对应的标签
 */
export const RISK_LEVEL_LABELS: Record<RiskLevel, { zh: string; en: string }> = {
  low: { zh: '低风险', en: 'Low Risk' },
  medium: { zh: '中风险', en: 'Medium Risk' },
  high: { zh: '高风险', en: 'High Risk' },
};

// 注册时间接近的阈值（毫秒）
export const CLOSE_REGISTRATION_TIME_THRESHOLD = 60 * 60 * 1000; // 1 小时

// IP 子网掩码（/24）
export const IP_SUBNET_MASK = 24;
