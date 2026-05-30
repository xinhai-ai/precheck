import { db } from '@/lib/db';
import {
  RISK_SCORE_WEIGHTS,
  CLOSE_REGISTRATION_TIME_THRESHOLD,
} from './constants';

interface RiskScoreResult {
  score: number;
  factors: {
    factor: string;
    score: number;
    description: string;
  }[];
}

/**
 * 计算指纹关联的风险评分
 * @param visitorId 指纹 ID
 * @param userIds 关联的用户 ID 列表
 */
export async function calculateRiskScore(
  visitorId: string,
  userIds: string[]
): Promise<RiskScoreResult> {
  const factors: RiskScoreResult['factors'] = [];
  let totalScore = 0;

  // 如果只有一个用户，没有风险
  if (userIds.length <= 1 || !db) {
    return { score: 0, factors: [] };
  }
  const database = db;

  // 1. 同一 visitorId 关联多个用户 - 基础分
  const sameVisitorScore = RISK_SCORE_WEIGHTS.SAME_VISITOR_ID;
  totalScore += sameVisitorScore;
  factors.push({
    factor: 'same_visitor_id',
    score: sameVisitorScore,
    description: `同一指纹关联 ${userIds.length} 个账号`,
  });

  // 获取所有相关指纹记录
  const fingerprints = await database.deviceFingerprint.findMany({
    where: {
      visitorId,
      userId: { in: userIds },
    },
    include: {
      user: {
        select: {
          id: true,
          createdAt: true,
        },
      },
    },
  });

  if (fingerprints.length < 2) {
    return { score: Math.max(0, Math.min(100, totalScore)), factors };
  }

  // 2. 检查 Canvas 哈希
  const canvasHashes = new Set(
    fingerprints.map((f) => f.canvasHash).filter(Boolean)
  );
  if (canvasHashes.size === 1 && fingerprints[0].canvasHash) {
    totalScore += RISK_SCORE_WEIGHTS.SAME_CANVAS_HASH;
    factors.push({
      factor: 'same_canvas_hash',
      score: RISK_SCORE_WEIGHTS.SAME_CANVAS_HASH,
      description: 'Canvas 渲染指纹相同',
    });
  }

  // 3. 检查 WebGL 渲染器
  const webglRenderers = new Set(
    fingerprints.map((f) => f.webglRenderer).filter(Boolean)
  );
  if (webglRenderers.size === 1 && fingerprints[0].webglRenderer) {
    totalScore += RISK_SCORE_WEIGHTS.SAME_WEBGL_RENDERER;
    factors.push({
      factor: 'same_webgl_renderer',
      score: RISK_SCORE_WEIGHTS.SAME_WEBGL_RENDERER,
      description: 'WebGL 渲染器相同',
    });
  }

  // 4. 检查 IP 子网
  const ipSubnets = new Set(
    fingerprints
      .map((f) => f.ip)
      .filter(Boolean)
      .map((ip) => getIPSubnet(ip!))
  );
  if (ipSubnets.size === 1) {
    totalScore += RISK_SCORE_WEIGHTS.SAME_IP_SUBNET;
    factors.push({
      factor: 'same_ip_subnet',
      score: RISK_SCORE_WEIGHTS.SAME_IP_SUBNET,
      description: '来自相同 IP 网段',
    });
  }

  // 5. 检查注册时间
  const users = fingerprints
    .map((f) => f.user)
    .filter((u): u is NonNullable<typeof u> => u !== null);

  if (users.length >= 2) {
    const registrationTimes = users.map((u) => u.createdAt.getTime()).sort();
    const timeDiff =
      registrationTimes[registrationTimes.length - 1] - registrationTimes[0];

    if (timeDiff < CLOSE_REGISTRATION_TIME_THRESHOLD) {
      totalScore += RISK_SCORE_WEIGHTS.CLOSE_REGISTRATION_TIME;
      factors.push({
        factor: 'close_registration_time',
        score: RISK_SCORE_WEIGHTS.CLOSE_REGISTRATION_TIME,
        description: `注册时间间隔小于 1 小时`,
      });
    }
  }

  // 6. 检查时区差异（减分因素）
  const timezones = new Set(
    fingerprints.map((f) => f.timezone).filter(Boolean)
  );
  if (timezones.size > 1) {
    totalScore += RISK_SCORE_WEIGHTS.DIFFERENT_TIMEZONE;
    factors.push({
      factor: 'different_timezone',
      score: RISK_SCORE_WEIGHTS.DIFFERENT_TIMEZONE,
      description: '时区不同，可能是误判',
    });
  }

  // 7. 检查语言差异（减分因素）
  const languages = new Set(
    fingerprints.map((f) => f.language).filter(Boolean)
  );
  if (languages.size > 1) {
    totalScore += RISK_SCORE_WEIGHTS.DIFFERENT_LANGUAGE;
    factors.push({
      factor: 'different_language',
      score: RISK_SCORE_WEIGHTS.DIFFERENT_LANGUAGE,
      description: '语言不同，可能是误判',
    });
  }

  // 确保分数在 0-100 范围内
  return {
    score: Math.max(0, Math.min(100, totalScore)),
    factors,
  };
}

/**
 * 获取 IP 的 /24 子网
 */
function getIPSubnet(ip: string): string {
  // 处理 IPv4
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  // IPv6 或其他格式，返回原始 IP
  return ip;
}
