/**
 * Compte à rebours d'une publicité, piloté par une logique pure
 * (`src/utils/countdown.ts`) et une horloge Date.now() :
 * - s'arrête à 0 (aucun débordement négatif) ;
 * - suspendu quand `paused` (arrière-plan / écran non focalisé) : le temps
 *   figé est décompté au retour, la pub ne « saute » pas des secondes ;
 * - `onTick` permet à l'appelant d'agréger le temps écoulé (compensation
 *   d'horloge) sans dupliquer la logique ;
 * - `onFinish` n'est appelé qu'une fois ; aucun setState après démontage.
 */
import { useEffect, useRef, useState } from 'react';
import { initialCountdownSeconds, shouldFinishAd, tickCountdown } from '../utils/countdown';

export interface CountdownState {
  remainingSeconds: number;
  totalSeconds: number;
  finished: boolean;
}

export interface UseCountdownOptions {
  paused: boolean;
  onFinish: () => void;
  /** Intervalle de tick en secondes (1 par défaut). */
  stepSeconds?: number;
  /** À chaque tick : agrégat personnalisé (ex. temps écoulé pour l'horloge). */
  onTick?: (remainingSeconds: number, stepSeconds: number) => void;
}

export function useCountdown(totalSeconds: number, options: UseCountdownOptions): CountdownState {
  const total = initialCountdownSeconds(totalSeconds);
  const step = options.stepSeconds && options.stepSeconds > 0 ? options.stepSeconds : 1;
  const [remaining, setRemaining] = useState(total);

  const mountedRef = useRef(true);
  const finishedRef = useRef(false);
  const callbacksRef = useRef({ onFinish: options.onFinish, onTick: options.onTick });
  callbacksRef.current = { onFinish: options.onFinish, onTick: options.onTick };

  useEffect(() => {
    mountedRef.current = true;
    finishedRef.current = false;
    setRemaining(total);
    return () => {
      mountedRef.current = false;
    };
  }, [total]);

  useEffect(() => {
    if (options.paused) return undefined;
    const interval = setInterval(() => {
      if (!mountedRef.current) return;
      setRemaining((current) => {
        if (shouldFinishAd(current)) return 0;
        const next = Math.max(0, tickCountdown(current) - (step - 1));
        callbacksRef.current.onTick?.(next, step);
        return next;
      });
    }, step * 1000);
    return () => clearInterval(interval);
  }, [options.paused, step]);

  useEffect(() => {
    if (!shouldFinishAd(remaining) || finishedRef.current) return;
    finishedRef.current = true;
    callbacksRef.current.onFinish();
  }, [remaining]);

  // `finished` est dérivé de l'état (sync au rendu) ; `finishedRef` ne sert
  // qu'à garantir un appel unique de onFinish.
  return { remainingSeconds: remaining, totalSeconds: total, finished: shouldFinishAd(remaining) };
}
