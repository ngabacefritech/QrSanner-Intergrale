/** Client API du dashboard : jeton stocké en localStorage, jamais en dur dans le code. */
import type { Campaign, CampaignDraft, ScanEvent, Stats } from './types';

const KEY_BASE = 'qrscanner.api.base';
const KEY_TOKEN = 'qrscanner.api.token';

export function getApiBase(): string {
  return localStorage.getItem(KEY_BASE) ?? '';
}
export function setApiBase(v: string) {
  localStorage.setItem(KEY_BASE, v.trim().replace(/\/+$/, ''));
}
export function getToken(): string {
  return localStorage.getItem(KEY_TOKEN) ?? '';
}
export function setToken(v: string) {
  localStorage.setItem(KEY_TOKEN, v.trim());
}

export class ApiError extends Error {
  status: number;
  errors?: string[];
  constructor(message: string, status: number, errors?: string[]) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

function url(path: string): string {
  const base = getApiBase();
  return `${base}${path}`;
}

const TIMEOUT_MS = 10_000;

async function request<T>(path: string, init: RequestInit = {}, withToken = true): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url(path), {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(withToken && getToken() ? { 'X-Api-Key': getToken() } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    const aborted = (error as Error)?.name === 'AbortError';
    throw new ApiError(
      aborted
        ? `Le serveur ne répond pas dans les ${TIMEOUT_MS / 1000} s.`
        : 'Serveur injoignable. Vérifiez que l’API est lancée et l’adresse saisie.',
      0
    );
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* réponse non JSON */
  }
  if (!response.ok) {
    const obj = (data ?? {}) as { error?: string; errors?: string[] };
    throw new ApiError(obj.error ?? `Erreur HTTP ${response.status}.`, response.status, obj.errors);
  }
  return data as T;
}

export const api = {
  health: () => request<{ ok: boolean; campaignsInDb: number }>('/health', {}, false),
  listCampaigns: () => request<{ campaigns: Campaign[] }>('/api/admin/campaigns').then((r) => r.campaigns),
  createCampaign: (draft: CampaignDraft) =>
    request<Campaign>('/api/admin/campaigns', { method: 'POST', body: JSON.stringify(draft) }),
  updateCampaign: (id: string, draft: Partial<CampaignDraft>) =>
    request<Campaign>(`/api/admin/campaigns/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(draft),
    }),
  deleteCampaign: (id: string) =>
    request<{ deleted: string }>(`/api/admin/campaigns/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  stats: (days = 14) => request<Stats>(`/api/admin/stats?days=${days}`),
  scans: (campaignId: string, limit = 50) =>
    request<{ campaignId: string; total: number; scans: ScanEvent[] }>(
      `/api/admin/scans/${encodeURIComponent(campaignId)}?limit=${limit}`
    ),
  /** URL de téléchargement du CSV (le jeton est passé en en-tête via fetch, pas dans l'URL). */
  exportCsv: async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000); // export potentiellement volumineux
    let response: Response;
    try {
      response = await fetch(url('/api/admin/stats/export.csv'), {
        headers: getToken() ? { 'X-Api-Key': getToken() } : {},
        signal: controller.signal,
      });
    } catch {
      throw new ApiError('Export impossible : serveur injoignable.', 0);
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) throw new ApiError('Export impossible.', response.status);
    return response.text();
  },
};
