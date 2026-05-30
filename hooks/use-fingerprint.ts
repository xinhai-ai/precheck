'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import FingerprintJS, { Agent, GetResult } from '@fingerprintjs/fingerprintjs';

export interface FingerprintData {
  visitorId: string;
  confidence: number;
  components: {
    userAgent?: string;
    browser?: string;
    os?: string;
    device?: string;
    language?: string;
    languages?: string[];
    platform?: string;
    screenResolution?: string;
    timezone?: string;
    timezoneOffset?: number;
    webglVendor?: string;
    webglRenderer?: string;
    canvasHash?: string;
    audioHash?: string;
    fonts?: string[];
  };
  raw?: GetResult;
}

interface UseFingerprintOptions {
  // 是否在挂载时自动采集
  autoCollect?: boolean;
  // 缓存时间（毫秒），默认 5 分钟
  cacheTime?: number;
}

interface UseFingerprintReturn {
  fingerprint: FingerprintData | null;
  isLoading: boolean;
  error: Error | null;
  collect: () => Promise<FingerprintData | null>;
}

// 全局缓存
let cachedFingerprint: FingerprintData | null = null;
let cacheTimestamp: number = 0;
let fpAgent: Agent | null = null;

const DEFAULT_CACHE_TIME = 5 * 60 * 1000; // 5 分钟

/**
 * 浏览器指纹采集 Hook
 * 使用 FingerprintJS 开源版采集设备指纹
 */
export function useFingerprint(
  options: UseFingerprintOptions = {}
): UseFingerprintReturn {
  const { autoCollect = true, cacheTime = DEFAULT_CACHE_TIME } = options;

  const [fingerprint, setFingerprint] = useState<FingerprintData | null>(
    cachedFingerprint
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const collectingRef = useRef(false);

  const collect = useCallback(async (): Promise<FingerprintData | null> => {
    // 检查缓存
    if (cachedFingerprint && Date.now() - cacheTimestamp < cacheTime) {
      setFingerprint(cachedFingerprint);
      return cachedFingerprint;
    }

    // 防止重复采集
    if (collectingRef.current) {
      return null;
    }

    collectingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // 初始化 FingerprintJS Agent（单例）
      if (!fpAgent) {
        fpAgent = await FingerprintJS.load();
      }

      // 获取指纹
      const result = await fpAgent.get();

      // 提取组件信息
      const components = result.components;

      const data: FingerprintData = {
        visitorId: result.visitorId,
        confidence: result.confidence.score,
        components: {
          userAgent:
            typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          browser: extractBrowser(components),
          os: extractOS(components),
          device: extractDevice(components),
          language: extractPrimaryLanguage(components),
          languages: extractLanguages(components),
          platform: getComponentValue(components.platform) as string,
          screenResolution: formatScreenResolution(components),
          timezone: getComponentValue(components.timezone) as string,
          timezoneOffset:
            typeof Intl !== 'undefined'
              ? -new Date().getTimezoneOffset()
              : undefined,
          webglVendor: extractWebGLVendor(components),
          webglRenderer: extractWebGLRenderer(components),
          canvasHash: extractCanvasHash(components),
          audioHash: extractAudioHash(components),
          fonts: getComponentValue(components.fonts) as string[],
        },
        raw: result,
      };

      // 更新缓存
      cachedFingerprint = data;
      cacheTimestamp = Date.now();

      setFingerprint(data);
      return data;
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error('Failed to collect fingerprint');
      setError(error);
      console.error('Fingerprint collection error:', error);
      return null;
    } finally {
      setIsLoading(false);
      collectingRef.current = false;
    }
  }, [cacheTime]);

  useEffect(() => {
    if (autoCollect && !cachedFingerprint) {
      collect();
    }
  }, [autoCollect, collect]);

  return {
    fingerprint,
    isLoading,
    error,
    collect,
  };
}

// 辅助函数：安全获取组件值
function getComponentValue(
  component: { value?: unknown; error?: unknown } | undefined
): unknown {
  if (!component) return undefined;
  if ('error' in component && component.error) return undefined;
  return component.value;
}

// 提取语言列表（FingerprintJS 的 languages 组件返回 string[][]）
function extractLanguages(
  components: GetResult['components']
): string[] | undefined {
  const value = getComponentValue(components.languages) as
    | string[][]
    | string[]
    | undefined;
  if (!value || value.length === 0) return undefined;
  // 扁平化嵌套数组
  return value.flat();
}

// 提取主语言
function extractPrimaryLanguage(
  components: GetResult['components']
): string | undefined {
  const languages = extractLanguages(components);
  return languages?.[0];
}

// 提取浏览器信息
function extractBrowser(
  components: GetResult['components']
): string | undefined {
  // FingerprintJS 开源版没有直接的浏览器信息，从 userAgent 解析
  if (typeof navigator === 'undefined') return undefined;

  const ua = navigator.userAgent;
  if (ua.includes('Firefox/')) {
    const match = ua.match(/Firefox\/(\d+)/);
    return match ? `Firefox ${match[1]}` : 'Firefox';
  }
  if (ua.includes('Edg/')) {
    const match = ua.match(/Edg\/(\d+)/);
    return match ? `Edge ${match[1]}` : 'Edge';
  }
  if (ua.includes('Chrome/')) {
    const match = ua.match(/Chrome\/(\d+)/);
    return match ? `Chrome ${match[1]}` : 'Chrome';
  }
  if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    const match = ua.match(/Version\/(\d+)/);
    return match ? `Safari ${match[1]}` : 'Safari';
  }
  return undefined;
}

// 提取操作系统信息
function extractOS(components: GetResult['components']): string | undefined {
  const platform = getComponentValue(components.platform) as string | undefined;
  if (!platform) return undefined;

  if (platform.includes('Win')) return 'Windows';
  if (platform.includes('Mac')) return 'macOS';
  if (platform.includes('Linux')) return 'Linux';
  if (platform.includes('iPhone') || platform.includes('iPad')) return 'iOS';
  if (platform.includes('Android')) return 'Android';
  return platform;
}

// 提取设备类型
function extractDevice(components: GetResult['components']): string | undefined {
  const platform = getComponentValue(components.platform) as string | undefined;
  if (!platform) return undefined;

  if (platform.includes('iPhone')) return 'iPhone';
  if (platform.includes('iPad')) return 'iPad';
  if (platform.includes('Android')) {
    // 检查是否是平板
    if (typeof navigator !== 'undefined' && navigator.userAgent.includes('Mobile')) {
      return 'Android Phone';
    }
    return 'Android Tablet';
  }
  if (platform.includes('Win') || platform.includes('Mac') || platform.includes('Linux')) {
    return 'Desktop';
  }
  return undefined;
}

// 格式化屏幕分辨率
function formatScreenResolution(
  components: GetResult['components']
): string | undefined {
  const resolution = getComponentValue(components.screenResolution) as
    | number[]
    | undefined;
  if (!resolution || resolution.length < 2) return undefined;
  return `${resolution[0]}x${resolution[1]}`;
}

// 提取 WebGL 供应商
function extractWebGLVendor(
  components: GetResult['components']
): string | undefined {
  const webgl = getComponentValue(components.webGlBasics) as
    | { vendor?: string }
    | undefined;
  return webgl?.vendor;
}

// 提取 WebGL 渲染器
function extractWebGLRenderer(
  components: GetResult['components']
): string | undefined {
  const webgl = getComponentValue(components.webGlBasics) as
    | { renderer?: string }
    | undefined;
  return webgl?.renderer;
}

// 提取 Canvas 哈希
function extractCanvasHash(
  components: GetResult['components']
): string | undefined {
  const canvas = getComponentValue(components.canvas) as
    | { geometry?: string; text?: string }
    | undefined;
  if (!canvas) return undefined;
  // 组合 geometry 和 text 作为 canvas hash
  return `${canvas.geometry || ''}_${canvas.text || ''}`.substring(0, 64);
}

// 提取 Audio 哈希
function extractAudioHash(
  components: GetResult['components']
): string | undefined {
  const audio = getComponentValue(components.audio) as number | undefined;
  return audio !== undefined ? String(audio) : undefined;
}

/**
 * 清除指纹缓存
 */
export function clearFingerprintCache(): void {
  cachedFingerprint = null;
  cacheTimestamp = 0;
}

/**
 * 获取当前缓存的指纹（不触发采集）
 */
export function getCachedFingerprint(): FingerprintData | null {
  if (cachedFingerprint && Date.now() - cacheTimestamp < DEFAULT_CACHE_TIME) {
    return cachedFingerprint;
  }
  return null;
}
