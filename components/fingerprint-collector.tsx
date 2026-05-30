'use client';

import { useEffect, useRef } from 'react';
import { useFingerprint, FingerprintData } from '@/hooks/use-fingerprint';

interface FingerprintCollectorProps {
  // 采集后的回调
  onCollected?: (data: FingerprintData) => void;
  // 是否自动上报到服务器
  autoReport?: boolean;
  // 上报成功后的回调
  onReported?: (result: { fingerprintId: string }) => void;
  // 上报失败后的回调
  onReportError?: (error: Error) => void;
}

/**
 * 指纹采集组件
 * 在页面加载时自动采集浏览器指纹，并可选择性地上报到服务器
 */
export function FingerprintCollector({
  onCollected,
  autoReport = true,
  onReported,
  onReportError,
}: FingerprintCollectorProps) {
  const { fingerprint, isLoading } = useFingerprint({ autoCollect: true });
  const reportedRef = useRef(false);

  useEffect(() => {
    if (!fingerprint || isLoading) return;

    // 触发采集回调
    onCollected?.(fingerprint);

    // 自动上报
    if (autoReport && !reportedRef.current) {
      reportedRef.current = true;
      reportFingerprint(fingerprint)
        .then((result) => {
          onReported?.(result);
        })
        .catch((error) => {
          onReportError?.(error);
          // 重置标记，允许重试
          reportedRef.current = false;
        });
    }
  }, [fingerprint, isLoading, autoReport, onCollected, onReported, onReportError]);

  // 这是一个无 UI 组件
  return null;
}

/**
 * 上报指纹到服务器
 */
async function reportFingerprint(
  data: FingerprintData
): Promise<{ fingerprintId: string }> {
  const response = await fetch('/api/fingerprint', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      visitorId: data.visitorId,
      confidence: data.confidence,
      components: data.components,
      raw: data.raw,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to report fingerprint');
  }

  return response.json();
}

/**
 * 手动上报指纹的工具函数
 */
export async function submitFingerprint(
  data: FingerprintData
): Promise<{ fingerprintId: string; linkInfo?: unknown }> {
  return reportFingerprint(data);
}
