/**
 * Helpers de navigation pur (testables sans React Navigation).
 * Les écrans branchent ces fonctions sur l'objet `navigation` réel.
 */
import type { RootStackParamList } from '../navigation/types';
import { clampDuration } from './validation';

/** Paramètres typés transmis à l'écran Advertisement après un scan réussi. */
export function buildAdvertisementParams(
  campaignId: string,
  qrValue: string,
  durationSeconds: number
): RootStackParamList['Advertisement'] {
  return {
    campaignId,
    qrValue,
    durationSeconds: clampDuration(durationSeconds, 10),
    resolvedAt: new Date().toISOString(),
  };
}

export interface FinishAdOptions {
  /** true si l'appelant a déjà consommé la fin de campagne (anti double goBack). */
  finishedRefValue: boolean;
  hasVideo: boolean;
  isImmersive: boolean;
  canGoBack: boolean;
}

export type FinishAdAction = 'pause-video' | 'restore-immersive' | 'go-back' | 'pop-ad-stack';

/**
 * Calcule la séquence de nettoyage à effectuer quand une publicité se termine
 * (fin du compte à rebours, appui sur « Passer » ou erreur média).
 * Idempotent : si `finishedRefValue` est déjà true, aucune action.
 */
export function computeAdFinishActions(options: FinishAdOptions): FinishAdAction[] {
  if (options.finishedRefValue) return [];
  const actions: FinishAdAction[] = [];
  if (options.hasVideo) actions.push('pause-video');
  if (options.isImmersive) actions.push('restore-immersive');
  actions.push(options.canGoBack ? 'go-back' : 'pop-ad-stack');
  return actions;
}
