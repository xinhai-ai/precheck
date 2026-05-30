import { requireDb } from '@/lib/db';
import { calculateRiskScore } from './risk-score';

interface LinkCheckResult {
  isNewLink: boolean;
  linkId: string | null;
  linkedUserCount: number;
  riskScore: number;
}

/**
 * 检查并创建/更新指纹关联记录
 * @param visitorId 指纹 ID
 * @param userId 当前用户 ID
 */
export async function checkAndCreateFingerprintLink(
  visitorId: string,
  userId: string
): Promise<LinkCheckResult> {
  const db = requireDb();
  // 查找该 visitorId 关联的所有用户
  const fingerprints = await db.deviceFingerprint.findMany({
    where: { visitorId },
    select: { userId: true },
    distinct: ['userId'],
  });

  // 收集所有关联的用户 ID（去重，排除 null）
  const linkedUserIds = new Set<string>();
  for (const fp of fingerprints) {
    if (fp.userId) {
      linkedUserIds.add(fp.userId);
    }
  }
  // 添加当前用户
  linkedUserIds.add(userId);

  const userIdsArray = Array.from(linkedUserIds);

  // 如果只有一个用户，不需要创建关联记录
  if (userIdsArray.length <= 1) {
    return {
      isNewLink: false,
      linkId: null,
      linkedUserCount: 1,
      riskScore: 0,
    };
  }

  // 计算风险评分
  const { score: riskScore } = await calculateRiskScore(visitorId, userIdsArray);

  // 查找或创建关联记录
  const existingLink = await db.fingerprintLink.findUnique({
    where: { visitorId },
  });

  let linkId: string;
  let isNewLink = false;

  if (existingLink) {
    // 检查是否有新用户加入
    const existingUserIds = new Set(existingLink.userIds);
    const hasNewUser = userIdsArray.some((id) => !existingUserIds.has(id));

    if (hasNewUser || existingLink.riskScore !== riskScore) {
      // 更新关联记录
      const updated = await db.fingerprintLink.update({
        where: { id: existingLink.id },
        data: {
          userIds: userIdsArray,
          riskScore,
          // 如果有新用户加入且之前已处理，重置为待审核
          status:
            hasNewUser && existingLink.status !== 'PENDING'
              ? 'PENDING'
              : existingLink.status,
        },
      });
      linkId = updated.id;
      isNewLink = hasNewUser;
    } else {
      linkId = existingLink.id;
    }
  } else {
    // 创建新的关联记录
    const created = await db.fingerprintLink.create({
      data: {
        visitorId,
        userIds: userIdsArray,
        riskScore,
        status: 'PENDING',
      },
    });
    linkId = created.id;
    isNewLink = true;
  }

  return {
    isNewLink,
    linkId,
    linkedUserCount: userIdsArray.length,
    riskScore,
  };
}

/**
 * 将匿名采集的指纹（userId 为空）认领给新注册的用户，
 * 并建立指纹关联。用于注册流程：用户在注册页采集指纹时尚未有 userId。
 * @param visitorId 指纹 ID
 * @param userId 新注册用户 ID
 */
export async function claimFingerprintForUser(
  visitorId: string,
  userId: string
): Promise<LinkCheckResult | null> {
  const db = requireDb();
  // 将该 visitorId 下尚未归属用户的指纹认领给当前用户
  await db.deviceFingerprint.updateMany({
    where: { visitorId, userId: null },
    data: { userId },
  });

  // 建立/更新关联
  return checkAndCreateFingerprintLink(visitorId, userId);
}

/**
 * 获取用户的指纹关联信息
 */
export async function getUserFingerprintLinks(userId: string) {
  const db = requireDb();
  // 获取用户的所有指纹
  const fingerprints = await db.deviceFingerprint.findMany({
    where: { userId },
    select: { visitorId: true },
    distinct: ['visitorId'],
  });

  if (fingerprints.length === 0) {
    return [];
  }

  const visitorIds = fingerprints.map((f) => f.visitorId);

  // 获取这些指纹的关联记录
  const links = await db.fingerprintLink.findMany({
    where: {
      visitorId: { in: visitorIds },
      userIds: { hasSome: [userId] },
    },
    orderBy: { riskScore: 'desc' },
  });

  return links;
}

/**
 * 获取指纹关联的详细信息（包括用户信息）
 */
export async function getFingerprintLinkDetails(linkId: string) {
  const db = requireDb();
  const link = await db.fingerprintLink.findUnique({
    where: { id: linkId },
    include: {
      reviewedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!link) {
    return null;
  }

  // 获取关联用户的详细信息
  const users = await db.user.findMany({
    where: { id: { in: link.userIds } },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      createdAt: true,
      country: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // 获取该 visitorId 的所有指纹记录
  const fingerprints = await db.deviceFingerprint.findMany({
    where: { visitorId: link.visitorId },
    orderBy: { firstSeenAt: 'asc' },
  });

  return {
    ...link,
    users,
    fingerprints,
  };
}
