import type { Bootstrap } from '../../shared/schema';
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/${path}`, { ...options, headers: { 'Content-Type':'application/json', ...options?.headers } });
  const data = await response.json(); if (!response.ok) throw new Error(data.error ?? '请求失败'); return data;
}
export const bootstrap = (run?: string, signal?: AbortSignal) => api<Bootstrap>(`bootstrap${run ? `?run=${encodeURIComponent(run)}` : ''}`, {signal});
export const assetUrl = (path: string) => `/local-assets/${path.replace(/^assets\//, '').split('/').map(encodeURIComponent).join('/')}`;
export function download(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value,null,2)], {type:'application/json'}));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
