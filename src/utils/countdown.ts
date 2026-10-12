/**
 * Logique du compte à rebours, isolée des composants pour être testable.
 * Un tick ne fait QUE décrémenter : la fin de la publicité est déclenchée
 * par le composant quand la valeur atteint 0.
 */

/** Durée initiale (secondes) ; durée invalide → repli sûr de 10 s. */
export function initialCountdownSeconds(totalSeconds: number): number {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 1) return 10;
  return Math.floor(totalSeconds);
}

/** Valeur restante après un tick d'une seconde (bornée inférieurement à 0). */
export function tickCountdown(remainingSeconds: number): number {
  if (!Number.isFinite(remainingSeconds) || remainingSeconds <= 0) return 0;
  return remainingSeconds - 1;
}

/** La pub doit-elle se terminer ? */
export function shouldFinishAd(remainingSeconds: number): boolean {
  return Number.isFinite(remainingSeconds) && remainingSeconds <= 0;
}

/** Progression linéaire 0 → 1 pour la barre d'avancement. */
export function countdownProgress(remainingSeconds: number, totalSeconds: number): number {
  if (totalSeconds <= 0) return 1;
  const elapsed = totalSeconds - remainingSeconds;
  return Math.min(1, Math.max(0, elapsed / totalSeconds));
}
