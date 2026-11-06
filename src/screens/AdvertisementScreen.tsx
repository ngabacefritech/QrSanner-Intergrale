/**
 * Écran publicitaire immersif.
 * - image locale/distante via <Image> ou vidéo MP4 via expo-video (SDK 57) ;
 * - compte à rebours de la durée de campagne, suspendu en arrière-plan ;
 * - aucun lien ouvert automatiquement, aucun contrôle utilisateur sur la vidéo ;
 * - à la fin (ou sur erreur média) : arrêt propre puis retour automatique au
 *   scanner, avec restauration de la barre d'état et de la barre de navigation Android.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import { VideoView, createVideoPlayer, type VideoPlayer } from 'expo-video';
import { useCountdown } from '../hooks/useCountdown';
import { useImmersiveScreen } from '../hooks/useImmersive';
import type { RootStackParamList } from '../navigation/types';
import { campaignService } from '../services/campaignService';
import { buildAd, buildAdFromEmbedded } from '../services/qrCodeService';
import { getCampaignService } from '../services/registryProvider';
import { colors, radius, typography } from '../theme';
import { countdownProgress } from '../utils/countdown';
import { resolveMediaSource } from '../utils/media';
import { CloseIcon } from '../components/Icons';
import { Countdown } from '../components/Countdown';
import { LoadingIndicator } from '../components/LoadingIndicator';

type Props = NativeStackScreenProps<RootStackParamList, 'Advertisement'>;

type AdPhase = 'loading' | 'playing' | 'error';

const VIDEO_STALL_TIMEOUT_MS = 6000;
const AD_FINISH_GRACE_MS = 1800;

export function AdvertisementScreen({ navigation, route }: Props) {
  const { campaignId, durationSeconds, origin, embedded } = route.params;
  const isFocused = useIsFocused();

  const [ad, setAd] = useState<ReturnType<typeof buildAd>>(null);
  const [adMissing, setAdMissing] = useState(false);
  const [phase, setPhase] = useState<AdPhase>('loading');
  const [mediaIssue, setMediaIssue] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const [player, setPlayer] = useState<VideoPlayer | null>(null);
  const [paused, setPaused] = useState(false);

  const playerRef = useRef<VideoPlayer | null>(null);
  const finishedRef = useRef(false);
  const immersive = useImmersiveScreen(true);

  // 1) Publicité : soit elle vient du QR (autonome), soit on la recharge du registre.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (origin === 'embedded' && embedded) {
          // Rien à recharger : le contenu a déjà été validé par le service de résolution.
          const built = buildAdFromEmbedded({
            id: embedded.campaignId,
            title: embedded.title,
            mediaType: embedded.mediaType,
            mediaUrl: embedded.mediaUrl,
            durationSeconds: embedded.durationSeconds,
            description: embedded.description,
            fallbackUrl: embedded.fallbackUrl,
            allowEarlySkip: embedded.allowEarlySkip,
          });
          if (cancelled) return;
          setAd(built);
          return;
        }
        const service = await getCampaignService();
        const record = (await service.findById(campaignId)) ?? (await campaignService.findById(campaignId));
        if (cancelled) return;
        const resolved = record ? buildAd(record) : null;
        if (!resolved) {
          setAdMissing(true);
          setPhase('error');
          setMediaIssue('Campagne introuvable ou durée invalide : retour au scanner imminent.');
          return;
        }
        setAd(resolved);
      } catch {
        if (!cancelled) {
          setAdMissing(true);
          setPhase('error');
          setMediaIssue('Erreur de chargement de la campagne : retour au scanner imminent.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId, origin, embedded]);

  // 2) Immersif : activé à l'entrée, TOUJOURS restauré à la sortie (unmount/blur).
  useEffect(() => {
    immersive.setImmersive(true);
    return () => immersive.setImmersive(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3) Arrière-plan ou perte de focus : pub suspendue (compte à rebours + vidéo).
  useEffect(() => {
    const appSubscription = AppState.addEventListener('change', (status) => {
      const background = status !== 'active';
      setPaused(background);
      if (background) playerRef.current?.pause();
    });
    return () => appSubscription.remove();
  }, []);

  useEffect(() => {
    setPaused(!isFocused);
    if (isFocused) playerRef.current?.play();
    else playerRef.current?.pause();
  }, [isFocused]);

  const finishAd = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    playerRef.current?.pause();
    immersive.setImmersive(false);
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.pop();
    // `immersive.restoreImmersive` est une ref stable (useMemo dans le hook).
  }, [navigation]);

  // 4) Compte à rebours du hook `useCountdown` (logique pure + ticks de 250 ms).
  const { remainingSeconds } = useCountdown(durationSeconds, {
    paused: paused || !ad,
    stepSeconds: 0.25,
    onFinish: finishAd,
  });

  // 5) Médias : source affichée (principale, ou repli si la vidéo est illisible).
  // Mémoïsée : les dépendances de l'effet vidéo doivent rester stables entre
  // les rendus (le compte à rebours re-rend l'écran 4×/s).
  const isVideo = ad?.mediaType === 'video';
  const resolvedMedia = useMemo(
    () => resolveMediaSource(usedFallback ? ad?.fallbackImage : ad?.mediaSource),
    [usedFallback, ad]
  );
  const mediaUri = resolvedMedia?.uri ?? null;

  // 6) Vidéo : expo-video — createVideoPlayer + listeners typés, arrêt propre au démontage.
  useEffect(() => {
    if (!ad || ad.mediaType !== 'video' || usedFallback) return undefined;

    if (!resolvedMedia) {
      if (ad.fallbackImage) {
        setUsedFallback(true);
        setMediaIssue('Vidéo indisponible : affichage de l’image de remplacement.');
        setPhase('playing');
      } else {
        setPhase('error');
        setMediaIssue('Vidéo indisponible : la publicité se termine.');
      }
      return undefined;
    }

    let created: VideoPlayer | null = null;
    try {
      created = createVideoPlayer({ uri: resolvedMedia.uri });
    } catch {
      created = null;
    }
    if (!created) {
      setPhase('error');
      setMediaIssue('Lecteur vidéo indisponible sur cet appareil.');
      return undefined;
    }

    const videoPlayer = created;
    playerRef.current = videoPlayer;
    setPlayer(videoPlayer);
    videoPlayer.muted = true;
    videoPlayer.loop = false;

    let stalled = false;
    const stallTimer = setTimeout(() => {
      stalled = true;
      if (ad.fallbackImage) {
        setUsedFallback(true);
        setMediaIssue('Vidéo trop lente à charger : image de remplacement affichée.');
        setPhase('playing');
      } else {
        setPhase('error');
        setMediaIssue('Impossible de charger la vidéo : fin de la publicité.');
      }
    }, VIDEO_STALL_TIMEOUT_MS);

    const statusSubscription = videoPlayer.addListener('statusChange', ({ status, error }) => {
      if (stalled) return;
      if (status === 'readyToPlay') {
        clearTimeout(stallTimer);
        setPhase('playing');
        setMediaIssue(null);
        try {
          videoPlayer.play();
        } catch {
          /* certains lecteurs démarrent seuls : sans impact */
        }
      } else if (status === 'error') {
        clearTimeout(stallTimer);
        const detail = error?.message ? ` (${error.message})` : '';
        if (ad.fallbackImage) {
          setUsedFallback(true);
          setMediaIssue(`Vidéo illisible${detail} : image de remplacement affichée.`);
          setPhase('playing');
        } else {
          setPhase('error');
          setMediaIssue(`Erreur de lecture vidéo${detail} : fin de la publicité.`);
        }
      } else if (status === 'loading') {
        setPhase('loading');
      }
    });

    const endSubscription = videoPlayer.addListener('playToEnd', () => {
      // La pub se termine à la fin de la vidéo ou à la fin du compte à rebours, au plus tôt.
      finishAd();
    });

    return () => {
      clearTimeout(stallTimer);
      statusSubscription.remove();
      endSubscription.remove();
      try {
        videoPlayer.pause();
      } catch {
        /* lecture déjà arrêtée */
      }
      playerRef.current = null;
      setPlayer(null);
    };
  }, [ad, usedFallback, mediaUri, finishAd]);

  if (adMissing || !ad) {
    return (
      <View style={styles.errorScreen}>
        {immersive.statusBar}
        <Text style={styles.errorTitle}>Publicité indisponible</Text>
        <Text style={styles.errorBody}>{mediaIssue ?? 'Retour au scanner…'}</Text>
        <LoadingIndicator label="Retour automatique au scanner" />
      </View>
    );
  }

  const total = Math.max(1, ad.durationSeconds);
  const remaining = remainingSeconds;
  const progress = countdownProgress(total - remaining, total);

  return (
    <View style={styles.screen}>
      {immersive.statusBar}

      <View style={styles.mediaLayer}>
        {isVideo && !usedFallback && phase !== 'error' && player ? (
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            nativeControls={false}
          />
        ) : null}

        {(!isVideo || usedFallback || phase === 'error') && resolvedMedia ? (
          <Image
            source={{ uri: resolvedMedia.uri }}
            style={StyleSheet.absoluteFill}
            resizeMode="contain"
            accessibilityLabel={`Publicité : ${ad.title}`}
            onError={() => {
              if (!usedFallback && ad.fallbackImage) {
                setUsedFallback(true);
                setMediaIssue('Média inaccessible : image de remplacement affichée.');
              } else {
                setPhase('error');
                setMediaIssue('Média définitivement inaccessible : fin de la publicité.');
              }
            }}
          />
        ) : null}

        {phase === 'error' ? (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorTitle}>Média indisponible</Text>
            <Text style={styles.errorBody}>{mediaIssue ?? 'La publicité se termine.'}</Text>
          </View>
        ) : null}

        {phase === 'loading' ? (
          <View style={styles.loadingWrap}>
            <LoadingIndicator label="Chargement du média publicitaire…" />
          </View>
        ) : null}
      </View>

      <View style={styles.topBar} pointerEvents="box-none">
        <View style={styles.titlePill}>
          <Text style={styles.demoTag}>PUBLI·DEMO</Text>
          <Text style={styles.adTitle} numberOfLines={1}>
            {ad.title}
          </Text>
        </View>
        <Countdown remainingSeconds={remaining} totalSeconds={total} />
      </View>

      <View style={styles.bottomBar} pointerEvents="box-none">
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <View style={styles.bottomRow}>
          <Text style={styles.hint}>
            {paused
              ? 'Lecture suspendue (arrière-plan)'
              : ad.description ?? 'Retour automatique au scanner à la fin.'}
          </Text>
          {ad.allowEarlySkip ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Passer la publicité"
              onPress={finishAd}
              style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
            >
              <Text style={styles.skipText}>Passer</Text>
              <CloseIcon color={colors.text} size={14} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {mediaIssue && phase !== 'error' ? (
        <View style={styles.mediaNotice} pointerEvents="none">
          <Text style={styles.mediaNoticeText}>{mediaIssue}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  mediaLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000000' },
  errorScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 14,
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
    backgroundColor: 'rgba(7,11,26,0.88)',
  },
  errorTitle: { ...typography.title, fontSize: 20, textAlign: 'center' },
  errorBody: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  loadingWrap: { position: 'absolute', top: '42%', left: 0, right: 0, alignItems: 'center' },
  topBar: {
    position: 'absolute',
    top: 44,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  titlePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.overlay,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  demoTag: { ...typography.mono, color: colors.success, fontSize: 10 },
  adTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  bottomBar: { position: 'absolute', bottom: 34, left: 16, right: 16, gap: 12 },
  progressTrack: {
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(148,163,184,0.25)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.success },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  hint: { flex: 1, color: colors.textMuted, fontSize: 12.5 },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.overlay,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  skipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  mediaNotice: { position: 'absolute', bottom: 96, left: 16, right: 16, alignItems: 'center' },
  mediaNoticeText: {
    color: colors.warning,
    fontSize: 12.5,
    backgroundColor: colors.overlay,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    textAlign: 'center',
  },
});
