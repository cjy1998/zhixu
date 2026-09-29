import { getToken } from './client';
import type { ProgressEvent, UsageEvent } from './types';

const BASE: string = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080/api';

export interface SseHandlers {
  onProgress?: (event: ProgressEvent) => void;
  onResult?: (data: unknown) => void;
  onUsage?: (event: UsageEvent) => void;
}

export async function streamSse<T>(
  path: string,
  body: unknown,
  handlers: SseHandlers,
  signal?: AbortSignal,
): Promise<T> {
  const token = getToken();
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`SSE 连接失败（HTTP ${response.status}）`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let resolved: T | null = null;
  let failed: Error | null = null;

  const dispatch = (rawEvent: string) => {
    let eventName = 'message';
    const dataLines: string[] = [];
    for (const line of rawEvent.split('\n')) {
      if (line.startsWith(':')) continue;
      if (line.startsWith('event:')) eventName = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    if (dataLines.length === 0) return;
    let payload: unknown;
    try {
      payload = JSON.parse(dataLines.join('\n'));
    } catch {
      return;
    }
    if (eventName === 'progress') handlers.onProgress?.(payload as ProgressEvent);
    else if (eventName === 'result') {
      resolved = payload as T;
      handlers.onResult?.(payload);
    } else if (eventName === 'usage') handlers.onUsage?.(payload as UsageEvent);
    else if (eventName === 'error')
      failed = new Error((payload as { message?: string }).message ?? '生成失败');
  };

  const pump = async (): Promise<void> => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      for (;;) {
        const index = buffer.indexOf('\n\n');
        if (index === -1) break;
        const rawEvent = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        dispatch(rawEvent);
      }
    }
  };

  try {
    await pump();
  } catch (error) {
    if (signal?.aborted) return null as T;
    throw error;
  }
  if (failed) throw failed;
  if (resolved === null) throw new Error('生成意外中断，请重试');
  return resolved;
}
