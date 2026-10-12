/**
 * Tests de la logique de compte à rebours et du retour au scanner
 * (fin normale, fin anticipée, erreurs média, idempotence).
 */
import {
  countdownProgress,
  initialCountdownSeconds,
  shouldFinishAd,
  tickCountdown,
} from '../src/utils/countdown';
import { buildAdvertisementParams, computeAdFinishActions } from '../src/utils/navigation';

describe('logique du compte à rebours', () => {
  it('borne la durée initiale', () => {
    expect(initialCountdownSeconds(10)).toBe(10);
    expect(initialCountdownSeconds(0)).toBe(10);
    expect(initialCountdownSeconds(-4)).toBe(10);
    expect(initialCountdownSeconds(Number.NaN)).toBe(10);
    expect(initialCountdownSeconds(42.9)).toBe(42);
  });

  it('décrémente d’une seconde sans jamais passer sous zéro', () => {
    expect(tickCountdown(10)).toBe(9);
    expect(tickCountdown(1)).toBe(0);
    expect(tickCountdown(0)).toBe(0);
    expect(tickCountdown(-5)).toBe(0);
  });

  it('déclenche la fin uniquement à zéro', () => {
    expect(shouldFinishAd(3)).toBe(false);
    expect(shouldFinishAd(1)).toBe(false);
    expect(shouldFinishAd(0)).toBe(true);
  });

  it('progression bornée entre 0 et 1', () => {
    expect(countdownProgress(10, 10)).toBe(0);
    expect(countdownProgress(5, 10)).toBe(0.5);
    expect(countdownProgress(0, 10)).toBe(1);
    expect(countdownProgress(-3, 10)).toBe(1);
    expect(countdownProgress(4, 0)).toBe(1);
  });

  it('un décompte complet de 10 s se termine après 10 ticks', () => {
    let remaining = initialCountdownSeconds(10);
    let ticks = 0;
    while (!shouldFinishAd(remaining) && ticks < 60) {
      remaining = tickCountdown(remaining);
      ticks += 1;
    }
    expect(ticks).toBe(10);
    expect(remaining).toBe(0);
  });
});

describe('paramètres transmis à l’écran Advertisement', () => {
  it('clamp la durée à la plage autorisée', () => {
    const params = buildAdvertisementParams('DEMO-IMAGE-001', 'https://qrscanner.local/demo/nzui-market', 7200);
    expect(params.durationSeconds).toBe(300);
    expect(params.campaignId).toBe('DEMO-IMAGE-001');
    expect(params.qrValue).toBe('https://qrscanner.local/demo/nzui-market');
    expect(typeof params.resolvedAt).toBe('string');
    expect(!Number.isNaN(Date.parse(params.resolvedAt))).toBe(true);
  });

  it('borne la durée à [1 ; 300] : aucune valeur aberrante ne sort du service', () => {
    expect(buildAdvertisementParams('X', 'Y', 0).durationSeconds).toBe(1);
    expect(buildAdvertisementParams('X', 'Y', -3).durationSeconds).toBe(1);
    expect(buildAdvertisementParams('X', 'Y', Number.NaN).durationSeconds).toBe(10);
    expect(buildAdvertisementParams('X', 'Y', 1e9).durationSeconds).toBe(300);
  });
});

describe('retour au scanner : séquence de nettoyage', () => {
  const full = { finishedRefValue: false, hasVideo: true, isImmersive: true, canGoBack: true };

  it('met en pause la vidéo, restaure l’immersif puis revient au scanner', () => {
    expect(computeAdFinishActions(full)).toEqual(['pause-video', 'restore-immersive', 'go-back']);
  });

  it('ne fait rien si la fin a déjà été consommée (anti double navigation)', () => {
    expect(computeAdFinishActions({ ...full, finishedRefValue: true })).toEqual([]);
  });

  it('omit la pause vidéo pour une publicité image', () => {
    expect(computeAdFinishActions({ ...full, hasVideo: false })).toEqual([
      'restore-immersive',
      'go-back',
    ]);
  });

  it('ne tente pas de restaurer l’immersif quand il n’était pas actif', () => {
    expect(computeAdFinishActions({ ...full, isImmersive: false })).toEqual(['pause-video', 'go-back']);
  });

  it('empile un pop de secours si goBack est impossible (erreur de navigation)', () => {
    expect(computeAdFinishActions({ ...full, canGoBack: false })).toEqual([
      'pause-video',
      'restore-immersive',
      'pop-ad-stack',
    ]);
  });

  it('appliquer la séquence appelle les bons callbacks exactement une fois', () => {
    const pause = jest.fn();
    const restore = jest.fn();
    const goBack = jest.fn();
    const pop = jest.fn();

    const apply = (finished: boolean) => {
      const actions = computeAdFinishActions({ finishedRefValue: finished, hasVideo: true, isImmersive: true, canGoBack: true });
      for (const action of actions) {
        if (action === 'pause-video') pause();
        if (action === 'restore-immersive') restore();
        if (action === 'go-back') goBack();
        if (action === 'pop-ad-stack') pop();
      }
    };

    apply(false);
    apply(true); // second appel ignoré

    expect(pause).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledTimes(1);
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(pop).not.toHaveBeenCalled();
  });
});

describe('applyImmersive — choix des API natives selon la plateforme', () => {
  it('masque la barre de navigation uniquement sur Android', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { applyImmersive } = require('../src/hooks/useImmersive');
    expect(applyImmersive(true, 'android')).toEqual({ hideStatusBar: true, hideAndroidNavigationBar: true });
    expect(applyImmersive(true, 'ios')).toEqual({ hideStatusBar: true, hideAndroidNavigationBar: false });
  });
});
