/**
 * Résolution des sources de médias (images et vidéos) :
 * - les assets locaux sont résolus via `Image.resolveAssetSource` puis passés
 *   en `uri` à l'API `expo-video` (les deux API sont compatibles côté image et vidéo) ;
 * - les URLs distantes sont re-validées avant usage.
 */
import { Image } from 'react-native';
import type { MediaSource } from '../types/campaign';
import { validateMediaUrl } from './validation';

export interface ResolvedMedia {
  readonly uri: string;
  readonly remote: boolean;
}

export type AssetResolver = (assetKey: number | string) => { uri?: string } | null;

const defaultResolver: AssetResolver = (assetKey) => {
  try {
    return Image.resolveAssetSource(assetKey as never);
  } catch {
    return null;
  }
};

/** Résout une source de média en URI utilisable ; `null` si refusée. */
export function resolveMediaSource(
  source: MediaSource | undefined,
  assetResolver: AssetResolver = defaultResolver
): ResolvedMedia | null {
  if (!source) return null;
  if (source.kind === 'asset') {
    const resolved = assetResolver(source.assetKey);
    return resolved?.uri ? { uri: resolved.uri, remote: false } : null;
  }
  const validation = validateMediaUrl(source.url);
  return validation.ok ? { uri: validation.url, remote: true } : null;
}
