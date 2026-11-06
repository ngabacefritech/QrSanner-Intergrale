/**
 * Configuration réseau de l'application mobile.
 *
 * Par défaut : AUCUNE. Rien n'est envoyé, rien n'est demandé (conformément à
 * la règle « aucun envoi sans configuration explicite »). L'utilisateur active
 * la synchronisation depuis l'écran « Connexion » de l'app.
 *
 * Le jeton administrateur n'existe pas côté mobile : l'API n'y est appelée
 * qu'en lecture publique (/api/campaigns) et pour déclarer un scan
 * (/api/admin/scans, sans secret, limité en débit côté serveur).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_CONFIG_STORAGE_KEY = 'qrscanner.api.config.v1';

export interface ApiConfig {
  /** Base de l'API, sans slash final. '' = désactivé. */
  readonly baseUrl: string;
  readonly enabled: boolean;
}

export const DEFAULT_API_CONFIG: ApiConfig = { baseUrl: '', enabled: false };

export type ApiConfigValidation = { ok: true; baseUrl: string } | { ok: false; message: string };

/** HTTPS obligatoire ; HTTP autorisé uniquement pour une adresse de réseau local. */
export function validateApiBaseUrl(raw: string): ApiConfigValidation {
  const value = raw.trim().replace(/\/+$/, '');
  if (value.length === 0) return { ok: false, message: 'Adresse vide.' };
  if (value.length > 200) return { ok: false, message: 'Adresse trop longue.' };
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, message: 'Adresse invalide : exemple http://192.168.1.20:4000' };
  }
  const protocol = parsed.protocol;
  if (protocol !== 'https:' && protocol !== 'http:') {
    return { ok: false, message: 'Seuls http:// et https:// sont acceptés.' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, message: 'Identifiants interdits dans l’adresse.' };
  }
  if (parsed.search || parsed.hash) {
    return { ok: false, message: 'Query et fragment interdits dans l’adresse de base.' };
  }
  const host = parsed.hostname.toLowerCase();
  const isPrivate =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (protocol === 'http:' && !isPrivate) {
    return { ok: false, message: 'HTTP autorisé uniquement en local (localhost ou 192.168.x.x).' };
  }
  // Un éventuel préfixe de chemin (API montée sous /qrscanner) est conservé.
  const path = parsed.pathname.replace(/\/+$/, '');
  return { ok: true, baseUrl: `${protocol}//${parsed.host}${path === '/' ? '' : path}` };
}

function sanitize(stored: unknown): ApiConfig {
  if (typeof stored !== 'object' || stored === null) return DEFAULT_API_CONFIG;
  const candidate = stored as { baseUrl?: unknown; enabled?: unknown };
  const baseUrl = typeof candidate.baseUrl === 'string' ? candidate.baseUrl : '';
  const enabled = candidate.enabled === true;
  if (!enabled || baseUrl.length === 0) return DEFAULT_API_CONFIG;
  const validation = validateApiBaseUrl(baseUrl);
  return validation.ok ? { baseUrl: validation.baseUrl, enabled: true } : DEFAULT_API_CONFIG;
}

export async function loadApiConfig(): Promise<ApiConfig> {
  try {
    const raw = await AsyncStorage.getItem(API_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_API_CONFIG;
    return sanitize(JSON.parse(raw));
  } catch {
    return DEFAULT_API_CONFIG;
  }
}

export async function saveApiConfig(config: ApiConfig): Promise<ApiConfig> {
  const validation = config.enabled ? validateApiBaseUrl(config.baseUrl) : { ok: true as const, baseUrl: '' };
  const next: ApiConfig = validation.ok
    ? { baseUrl: config.enabled ? validation.baseUrl : '', enabled: config.enabled && validation.baseUrl.length > 0 }
    : DEFAULT_API_CONFIG;
  try {
    await AsyncStorage.setItem(API_CONFIG_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // stockage indisponible : la config reste en mémoire pour la session
  }
  return next;
}

/** Instance en mémoire pour éviter de relire AsyncStorage à chaque scan. */
let cached: ApiConfig | null = null;

export async function getApiConfig(): Promise<ApiConfig> {
  if (cached) return cached;
  cached = await loadApiConfig();
  return cached;
}

export async function setApiConfig(config: ApiConfig): Promise<ApiConfig> {
  cached = await saveApiConfig(config);
  return cached;
}

export function resetApiConfigCache(): void {
  cached = null;
}
